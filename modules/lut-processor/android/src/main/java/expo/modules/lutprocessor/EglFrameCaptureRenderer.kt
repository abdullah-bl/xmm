@file:Suppress("ktlint:standard:max-line-length")

package expo.modules.lutprocessor

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.opengl.EGL14
import android.opengl.GLES30
import android.opengl.GLUtils
import java.io.File
import java.io.FileOutputStream
import java.nio.Buffer
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLContext
import javax.microedition.khronos.egl.EGLDisplay
import javax.microedition.khronos.egl.EGLSurface

/**
 * Single-pass framed capture: decode → crop → optional LUT → frame composite → one JPEG encode.
 */
internal object EglFrameCaptureRenderer {
  private const val VERT = """#version 300 es
const vec2 kPos[3] = vec2[3](
  vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0)
);
const vec2 kUv[3] = vec2[3](
  vec2(0.0, 0.0), vec2(2.0, 0.0), vec2(0.0, 2.0)
);
out vec2 vUv;
void main() {
  gl_Position = vec4(kPos[gl_VertexID], 0.0, 1.0);
  vUv = kUv[gl_VertexID];
}
"""

  private const val PASSTHROUGH_FRAG = """#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oFrag;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform float uMirror;
uniform sampler2D uSource;
void main() {
  vec2 uv = vUv * uCropScale + uCropOffset;
  if (uMirror > 0.5) {
    uv.x = uCropOffset.x + uCropScale.x * (1.0 - vUv.x);
  }
  oFrag = vec4(texture(uSource, uv).rgb, 1.0);
}
"""

  private const val HALD_FRAG = """#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oFrag;
uniform float uLevel;
uniform float uIntensity;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform float uMirror;
uniform sampler2D uSource;
uniform sampler2D uHaldLut;
vec2 haldIndexToUV(float idx, float W) {
  float x = mod(idx, W);
  float y = floor(idx / W);
  return vec2((x + 0.5) / W, (y + 0.5) / W);
}
vec3 sampleHaldCell(sampler2D tex, float r, float g, float b, float cSize, float W) {
  float idx = b * cSize * cSize + g * cSize + r;
  return texture(tex, haldIndexToUV(idx, W)).rgb;
}
vec3 applyHaldTrilinear(sampler2D tex, vec3 color, float level) {
  float cSize = level * level;
  vec3 p = color * (cSize - 1.0);
  vec3 c0 = floor(p);
  vec3 t = p - c0;
  c0 = clamp(c0, vec3(0.0), vec3(cSize - 1.0));
  vec3 c1 = min(c0 + 1.0, vec3(cSize - 1.0));
  float W = level * level * level;
  vec3 s000 = sampleHaldCell(tex, c0.r, c0.g, c0.b, cSize, W);
  vec3 s100 = sampleHaldCell(tex, c1.r, c0.g, c0.b, cSize, W);
  vec3 s010 = sampleHaldCell(tex, c0.r, c1.g, c0.b, cSize, W);
  vec3 s110 = sampleHaldCell(tex, c1.r, c1.g, c0.b, cSize, W);
  vec3 s001 = sampleHaldCell(tex, c0.r, c0.g, c1.b, cSize, W);
  vec3 s101 = sampleHaldCell(tex, c1.r, c0.g, c1.b, cSize, W);
  vec3 s011 = sampleHaldCell(tex, c0.r, c1.g, c1.b, cSize, W);
  vec3 s111 = sampleHaldCell(tex, c1.r, c1.g, c1.b, cSize, W);
  vec3 x00 = mix(s000, s100, t.r);
  vec3 x10 = mix(s010, s110, t.r);
  vec3 x01 = mix(s001, s101, t.r);
  vec3 x11 = mix(s011, s111, t.r);
  vec3 y0 = mix(x00, x10, t.g);
  vec3 y1 = mix(x01, x11, t.g);
  return mix(y0, y1, t.b);
}
void main() {
  vec2 uv = vUv * uCropScale + uCropOffset;
  if (uMirror > 0.5) {
    uv.x = uCropOffset.x + uCropScale.x * (1.0 - vUv.x);
  }
  vec3 src = texture(uSource, uv).rgb;
  vec3 graded = applyHaldTrilinear(uHaldLut, src, uLevel);
  vec3 outRgb = mix(src, graded, uIntensity);
  oFrag = vec4(outRgb, 1.0);
}
"""

  private const val CUBE_FRAG = """#version 300 es
precision highp float;
precision highp sampler2D;
precision highp sampler3D;
in vec2 vUv;
out vec4 oFrag;
uniform vec3 uDomainMin;
uniform vec3 uDomainMax;
uniform float uIntensity;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform float uMirror;
uniform sampler2D uSource;
uniform sampler3D uLut3d;
void main() {
  vec2 uv = vUv * uCropScale + uCropOffset;
  if (uMirror > 0.5) {
    uv.x = uCropOffset.x + uCropScale.x * (1.0 - vUv.x);
  }
  vec3 src = texture(uSource, uv).rgb;
  vec3 denom = max(uDomainMax - uDomainMin, vec3(1e-8));
  vec3 p = clamp((src - uDomainMin) / denom, 0.0, 1.0);
  vec3 graded = texture(uLut3d, p).rgb;
  oFrag = vec4(mix(src, graded, uIntensity), 1.0);
}
"""

  private const val COMPOSITE_FRAG = """#version 300 es
precision highp float;
in vec2 vUv;
out vec4 oFrag;
uniform vec4 uCutoutRect;
uniform sampler2D uPhoto;
uniform sampler2D uFrame;
void main() {
  vec4 frameCol = texture(uFrame, vUv);
  vec2 cutoutMin = uCutoutRect.xy;
  vec2 cutoutSize = uCutoutRect.zw;
  vec2 cutoutMax = cutoutMin + cutoutSize;
  bool inCutout = all(greaterThanEqual(vUv, cutoutMin)) && all(lessThanEqual(vUv, cutoutMax));
  vec2 photoUV = (vUv - cutoutMin) / max(cutoutSize, vec2(1e-6));
  vec3 photo = inCutout ? texture(uPhoto, photoUV).rgb : vec3(0.0);
  vec3 outRgb = mix(photo, frameCol.rgb, frameCol.a);
  oFrag = vec4(outRgb, 1.0);
}
"""

  fun process(
    imagePath: String,
    framePath: String,
    lutPath: String?,
    intensity: Float,
    mirror: Boolean,
    ctx: Context,
    jpegQuality: Int = 95,
  ): String {
    val cutout = FrameAnalysis.analyze(framePath)
    val sourceBmp = SourceImageLoader.decodeUprightBitmap(imagePath)
    val frameBmp = BitmapFactory.decodeFile(framePath)
      ?: throw IllegalArgumentException("Could not load frame image: $framePath")

    val crop = CropMath.centreCrop(
      sourceBmp.width,
      sourceBmp.height,
      CropMath.cutoutAspectRatio(cutout),
    )
    val photoW = cutout.width
    val photoH = cutout.height
    val outW = cutout.frameWidth
    val outH = cutout.frameHeight

    val useCube = !lutPath.isNullOrEmpty() && lutPath!!.endsWith(".cube", ignoreCase = true)
    val useHald = !lutPath.isNullOrEmpty() && !useCube
    var lutBmp: Bitmap? = null
    var haldLevel = 0f
    if (useHald) {
      lutBmp =
        BitmapFactory.decodeFile(lutPath!!, BitmapFactory.Options().apply { inScaled = false })
          ?: throw IllegalStateException("Could not load LUT: $lutPath")
      if (lutBmp!!.width != lutBmp!!.height) {
        val w = lutBmp!!.width
        val h = lutBmp!!.height
        lutBmp!!.recycle()
        lutBmp = null
        throw IllegalStateException("Invalid Hald CLUT: must be square, got ${w}x$h")
      }
      try {
        haldLevel = haldLevelFromLutSide(lutBmp!!.width)
      } catch (e: Throwable) {
        lutBmp!!.recycle()
        lutBmp = null
        throw e
      }
    }

    val egl = EglState()
    return try {
      egl.makeCurrent()
      val vao = IntArray(1)
      GLES30.glGenVertexArrays(1, vao, 0)
      GLES30.glBindVertexArray(vao[0])

      val fbo = IntArray(1)
      val photoTex = IntArray(1)
      val frameTex = IntArray(1)
      val sourceTex = IntArray(1)
      val outputTex = IntArray(1)
      val lut3d = IntArray(1)
      val haldTex = IntArray(1)
      GLES30.glGenFramebuffers(1, fbo, 0)
      GLES30.glGenTextures(1, photoTex, 0)
      GLES30.glGenTextures(1, frameTex, 0)
      GLES30.glGenTextures(1, sourceTex, 0)
      GLES30.glGenTextures(1, outputTex, 0)
      if (useCube) GLES30.glGenTextures(1, lut3d, 0)
      if (useHald) GLES30.glGenTextures(1, haldTex, 0)

      val photoProgram = buildProgram(PASSTHROUGH_FRAG)
      val compositeProgram = buildProgram(COMPOSITE_FRAG)
      var cubeProgram = 0
      var haldProgram = 0
      var cube: CubeLutData? = null

      try {
        initRgbaTexture2D(sourceTex[0], sourceBmp.width, sourceBmp.height)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, sourceTex[0])
        GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, sourceBmp, 0)
        bindLinearClamp2d(sourceTex[0])

        initRgbaTexture2D(frameTex[0], frameBmp.width, frameBmp.height)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, frameTex[0])
        GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, frameBmp, 0)
        bindLinearClamp2d(frameTex[0])

        val activePhotoProgram = when {
          useCube -> {
            cube = CubeLutParser.parseFile(lutPath!!)
            cubeProgram = buildProgram(CUBE_FRAG)
            val n = cube!!.size
            GLES30.glBindTexture(GLES30.GL_TEXTURE_3D, lut3d[0])
            val buf: Buffer = ByteBuffer.wrap(cube!!.rgba8).order(ByteOrder.nativeOrder())
            GLES30.glPixelStorei(GLES30.GL_UNPACK_ALIGNMENT, 1)
            GLES30.glTexImage3D(
              GLES30.GL_TEXTURE_3D, 0, GLES30.GL_RGBA8, n, n, n, 0,
              GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, buf,
            )
            bindLinearClamp3d(lut3d[0])
            cubeProgram
          }
          useHald -> {
            haldProgram = buildProgram(HALD_FRAG)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, haldTex[0])
            GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, lutBmp!!, 0)
            bindLinearClamp2d(haldTex[0])
            haldProgram
          }
          else -> photoProgram
        }

        initRgbaTexture2D(photoTex[0], photoW, photoH)
        bindLinearClamp2d(photoTex[0])
        bindFbo(fbo[0], photoTex[0], photoW, photoH)
        GLES30.glUseProgram(activePhotoProgram)
        GLES30.glClearColor(0f, 0f, 0f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
        GLES30.glUniform2f(
          GLES30.glGetUniformLocation(activePhotoProgram, "uCropScale"),
          crop.scaleX,
          crop.scaleY,
        )
        GLES30.glUniform2f(
          GLES30.glGetUniformLocation(activePhotoProgram, "uCropOffset"),
          crop.offsetX,
          crop.offsetY,
        )
        GLES30.glUniform1f(
          GLES30.glGetUniformLocation(activePhotoProgram, "uMirror"),
          if (mirror) 1f else 0f,
        )
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, sourceTex[0])
        GLES30.glUniform1i(GLES30.glGetUniformLocation(activePhotoProgram, "uSource"), 0)
        when {
          useCube && cube != null -> {
            GLES30.glUniform3f(
              GLES30.glGetUniformLocation(activePhotoProgram, "uDomainMin"),
              cube!!.domainMin[0],
              cube!!.domainMin[1],
              cube!!.domainMin[2],
            )
            GLES30.glUniform3f(
              GLES30.glGetUniformLocation(activePhotoProgram, "uDomainMax"),
              cube!!.domainMax[0],
              cube!!.domainMax[1],
              cube!!.domainMax[2],
            )
            GLES30.glUniform1f(
              GLES30.glGetUniformLocation(activePhotoProgram, "uIntensity"),
              intensity,
            )
            GLES30.glActiveTexture(GLES30.GL_TEXTURE1)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_3D, lut3d[0])
            GLES30.glUniform1i(GLES30.glGetUniformLocation(activePhotoProgram, "uLut3d"), 1)
          }
          useHald -> {
            GLES30.glUniform1f(
              GLES30.glGetUniformLocation(activePhotoProgram, "uLevel"),
              haldLevel,
            )
            GLES30.glUniform1f(
              GLES30.glGetUniformLocation(activePhotoProgram, "uIntensity"),
              intensity,
            )
            GLES30.glActiveTexture(GLES30.GL_TEXTURE1)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, haldTex[0])
            GLES30.glUniform1i(GLES30.glGetUniformLocation(activePhotoProgram, "uHaldLut"), 1)
          }
        }
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)
        checkGl("photo pass")

        initRgbaTexture2D(outputTex[0], outW, outH)
        bindLinearClamp2d(outputTex[0])
        bindFbo(fbo[0], outputTex[0], outW, outH)
        GLES30.glUseProgram(compositeProgram)
        GLES30.glClearColor(0f, 0f, 0f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
        val fw = cutout.frameWidth.toFloat()
        val fh = cutout.frameHeight.toFloat()
        GLES30.glUniform4f(
          GLES30.glGetUniformLocation(compositeProgram, "uCutoutRect"),
          cutout.x / fw,
          cutout.y / fh,
          cutout.width / fw,
          cutout.height / fh,
        )
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, photoTex[0])
        GLES30.glUniform1i(GLES30.glGetUniformLocation(compositeProgram, "uPhoto"), 0)
        GLES30.glActiveTexture(GLES30.GL_TEXTURE1)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, frameTex[0])
        GLES30.glUniform1i(GLES30.glGetUniformLocation(compositeProgram, "uFrame"), 1)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)
        checkGl("composite pass")

        val bytes = readPixelsRgba(outW, outH)
        val outFile = File.createTempFile("lut_", ".jpg", ctx.cacheDir)
        FileOutputStream(outFile).use { fos ->
          val argb = rgbaToArgbTopDown(bytes, outW, outH)
          val bitmap = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
          bitmap.setPixels(argb, 0, outW, 0, 0, outW, outH)
          bitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality.coerceIn(1, 100), fos)
          bitmap.recycle()
        }
        outFile.absolutePath
      } finally {
        GLES30.glBindVertexArray(0)
        GLES30.glDeleteVertexArrays(1, vao, 0)
        GLES30.glDeleteProgram(photoProgram)
        GLES30.glDeleteProgram(compositeProgram)
        if (cubeProgram != 0) GLES30.glDeleteProgram(cubeProgram)
        if (haldProgram != 0) GLES30.glDeleteProgram(haldProgram)
        GLES30.glDeleteFramebuffers(1, fbo, 0)
        GLES30.glDeleteTextures(1, photoTex, 0)
        GLES30.glDeleteTextures(1, frameTex, 0)
        GLES30.glDeleteTextures(1, sourceTex, 0)
        GLES30.glDeleteTextures(1, outputTex, 0)
        if (useCube) GLES30.glDeleteTextures(1, lut3d, 0)
        if (useHald) GLES30.glDeleteTextures(1, haldTex, 0)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
      }
    } finally {
      sourceBmp.recycle()
      frameBmp.recycle()
      lutBmp?.recycle()
      egl.release()
    }
  }

  private fun haldLevelFromLutSide(side: Int): Float {
    val s = side.toFloat()
    val r = Math.cbrt(s.toDouble())
    val l = Math.round(r).toInt()
    if (l < 2) throw IllegalStateException("Invalid Hald CLUT: side = $side")
    if (Math.abs(Math.pow(l.toDouble(), 3.0) - s) > 0.5) {
      throw IllegalStateException("Invalid Hald CLUT: expected side = L^3 (e.g. 64, 512), got $side")
    }
    return l.toFloat()
  }

  private fun bindFbo(fbo: Int, colorTex: Int, w: Int, h: Int) {
    GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo)
    GLES30.glFramebufferTexture2D(
      GLES30.GL_FRAMEBUFFER,
      GLES30.GL_COLOR_ATTACHMENT0,
      GLES30.GL_TEXTURE_2D,
      colorTex,
      0,
    )
    val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
    if (status != GLES30.GL_FRAMEBUFFER_COMPLETE) {
      throw IllegalStateException("FBO incomplete: 0x${Integer.toHexString(status)}")
    }
    GLES30.glViewport(0, 0, w, h)
  }

  private fun initRgbaTexture2D(tex: Int, w: Int, h: Int) {
    GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
    GLES30.glTexImage2D(
      GLES30.GL_TEXTURE_2D,
      0,
      GLES30.GL_RGBA,
      w,
      h,
      0,
      GLES30.GL_RGBA,
      GLES30.GL_UNSIGNED_BYTE,
      null,
    )
  }

  private fun bindLinearClamp2d(tex: Int) {
    GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
  }

  private fun bindLinearClamp3d(id: Int) {
    GLES30.glBindTexture(GLES30.GL_TEXTURE_3D, id)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_3D, GLES30.GL_TEXTURE_WRAP_R, GLES30.GL_CLAMP_TO_EDGE)
  }

  private fun readPixelsRgba(w: Int, h: Int): ByteArray {
    val buf = ByteArray(w * h * 4)
    val b = ByteBuffer.wrap(buf)
    b.order(ByteOrder.nativeOrder())
    GLES30.glReadPixels(0, 0, w, h, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, b)
    checkGl("readPixels")
    return buf
  }

  private fun rgbaToArgbTopDown(rgba: ByteArray, w: Int, h: Int): IntArray {
    val row = w * 4
    val out = IntArray(w * h)
    for (y in 0 until h) {
      val srcY = h - 1 - y
      val srcRow = srcY * row
      for (x in 0 until w) {
        val s = srcRow + x * 4
        val r = rgba[s].toInt() and 0xff
        val g = rgba[s + 1].toInt() and 0xff
        val b = rgba[s + 2].toInt() and 0xff
        out[y * w + x] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return out
  }

  private fun checkGl(tag: String) {
    var err = GLES30.glGetError()
    if (err != GLES30.GL_NO_ERROR) {
      val stack = StringBuilder("0x${Integer.toHexString(err)}")
      while (true) {
        err = GLES30.glGetError()
        if (err == GLES30.GL_NO_ERROR) break
        stack.append(" 0x${Integer.toHexString(err)}")
      }
      error("$tag: GL $stack")
    }
  }

  private fun buildProgram(fragmentSource: String): Int {
    val vs = compileShader(GLES30.GL_VERTEX_SHADER, VERT)
    val fs = compileShader(GLES30.GL_FRAGMENT_SHADER, fragmentSource)
    val p = GLES30.glCreateProgram()
    GLES30.glAttachShader(p, vs)
    GLES30.glAttachShader(p, fs)
    GLES30.glLinkProgram(p)
    val link = IntArray(1)
    GLES30.glGetProgramiv(p, GLES30.GL_LINK_STATUS, link, 0)
    GLES30.glDeleteShader(vs)
    GLES30.glDeleteShader(fs)
    if (link[0] != GLES30.GL_TRUE) {
      val log = GLES30.glGetProgramInfoLog(p)
      GLES30.glDeleteProgram(p)
      error("GL program (frame): $log")
    }
    return p
  }

  private fun compileShader(type: Int, src: String): Int {
    val s = GLES30.glCreateShader(type)
    GLES30.glShaderSource(s, src)
    GLES30.glCompileShader(s)
    val stat = IntArray(1)
    GLES30.glGetShaderiv(s, GLES30.GL_COMPILE_STATUS, stat, 0)
    if (stat[0] != GLES30.GL_TRUE) {
      val log = GLES30.glGetShaderInfoLog(s)
      GLES30.glDeleteShader(s)
      error("GL shader (frame): $log")
    }
    return s
  }

  private class EglState {
    private val egl: EGL10 = EGLContext.getEGL() as EGL10
    private var display: EGLDisplay? = null
    private var context: EGLContext? = null
    private var surface: EGLSurface? = null

    fun makeCurrent() {
      val d = egl.eglGetDisplay(EGL10.EGL_DEFAULT_DISPLAY) ?: error("eglGetDisplay failed")
      if (!egl.eglInitialize(d, IntArray(2))) error("eglInitialize failed")
      this.display = d
      val attribs = intArrayOf(
        EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8,
        EGL10.EGL_ALPHA_SIZE, 8, EGL10.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES3_BIT,
        EGL10.EGL_SURFACE_TYPE, EGL10.EGL_PBUFFER_BIT, EGL10.EGL_NONE,
      )
      val configs = arrayOfNulls<EGLConfig>(1)
      val n = IntArray(1)
      if (!egl.eglChooseConfig(d, attribs, configs, 1, n) || n[0] < 1) error("eglChooseConfig failed")
      val c = configs[0]!!
      val ctxAttrs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 3, EGL10.EGL_NONE)
      val ectx = egl.eglCreateContext(d, c, EGL10.EGL_NO_CONTEXT, ctxAttrs) ?: error("eglCreateContext failed")
      this.context = ectx
      val sattrs = intArrayOf(EGL10.EGL_WIDTH, 2, EGL10.EGL_HEIGHT, 2, EGL10.EGL_NONE)
      val surf = egl.eglCreatePbufferSurface(d, c, sattrs) ?: error("eglCreatePbufferSurface failed")
      this.surface = surf
      if (!egl.eglMakeCurrent(d, surf, surf, ectx)) error("eglMakeCurrent failed")
    }

    fun release() {
      val d = display
      if (d != null) {
        egl.eglMakeCurrent(d, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_CONTEXT)
        context?.let { egl.eglDestroyContext(d, it) }
        surface?.let { egl.eglDestroySurface(d, it) }
        egl.eglTerminate(d)
      }
    }
  }
}
