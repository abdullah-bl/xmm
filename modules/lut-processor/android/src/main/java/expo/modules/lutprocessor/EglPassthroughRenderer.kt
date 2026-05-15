/**
 * Centre-crop (and optional LUT) for still captures. A dedicated long-lived EGL
 * context for burst stills is not used yet — each call still spins EGL up/down.
 */
@file:Suppress("ktlint:standard:max-line-length")

package expo.modules.lutprocessor

import android.content.Context
import android.graphics.Bitmap
import android.opengl.EGL14
import android.opengl.GLES30
import android.opengl.GLUtils
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLContext
import javax.microedition.khronos.egl.EGLDisplay
import javax.microedition.khronos.egl.EGLSurface

/**
 * No-LUT path used when a capture should be centre-cropped and re-encoded
 * without colour grading. Shares the same crop-uniform contract as the
 * Hald / .cube renderers so the JS caller can always go through a single
 * native entry point.
 */
internal object EglPassthroughRenderer {
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

  private const val FRAG = """#version 300 es
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

  fun process(
    imagePath: String,
    aspectRatio: String,
    cropAspectRatio: Float? = null,
    mirror: Boolean,
    ctx: Context,
    jpegQuality: Int = 95,
  ): String {
    val sourceBmp = SourceImageLoader.decodeUprightBitmap(imagePath)
    val crop = CropMath.centreCrop(
      sourceBmp.width,
      sourceBmp.height,
      CropMath.resolveTargetRatio(
        aspectRatio,
        cropAspectRatio,
        sourceBmp.width,
        sourceBmp.height,
      ),
    )
    val outW = crop.width
    val outH = crop.height
    val egl = EglState()
    return try {
      egl.makeCurrent()
      val program = buildProgram()
      val uSource = GLES30.glGetUniformLocation(program, "uSource")
      val uCropScale = GLES30.glGetUniformLocation(program, "uCropScale")
      val uCropOffset = GLES30.glGetUniformLocation(program, "uCropOffset")
      val uMirror = GLES30.glGetUniformLocation(program, "uMirror")
      val fbo = IntArray(1)
      val colorTex = IntArray(1)
      val sourceTex = IntArray(1)
      val vao = IntArray(1)
      GLES30.glGenVertexArrays(1, vao, 0)
      GLES30.glBindVertexArray(vao[0])
      GLES30.glGenFramebuffers(1, fbo, 0)
      GLES30.glGenTextures(1, colorTex, 0)
      GLES30.glGenTextures(1, sourceTex, 0)
      try {
        initRgbaTexture2D(colorTex[0], outW, outH)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, sourceTex[0])
        GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, sourceBmp, 0)
        checkGl("texImage2D source (passthrough)")
        bindLinearClamp(sourceTex[0])
        bindLinearClamp(colorTex[0])
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, fbo[0])
        GLES30.glFramebufferTexture2D(
          GLES30.GL_FRAMEBUFFER, GLES30.GL_COLOR_ATTACHMENT0,
          GLES30.GL_TEXTURE_2D, colorTex[0], 0,
        )
        val status = GLES30.glCheckFramebufferStatus(GLES30.GL_FRAMEBUFFER)
        if (status != GLES30.GL_FRAMEBUFFER_COMPLETE) {
          throw IllegalStateException("FBO incomplete: 0x${Integer.toHexString(status)}")
        }
        GLES30.glViewport(0, 0, outW, outH)
        GLES30.glUseProgram(program)
        GLES30.glClearColor(0f, 0f, 0f, 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
        GLES30.glUniform2f(uCropScale, crop.scaleX, crop.scaleY)
        GLES30.glUniform2f(uCropOffset, crop.offsetX, crop.offsetY)
        GLES30.glUniform1f(uMirror, if (mirror) 1f else 0f)
        GLES30.glActiveTexture(GLES30.GL_TEXTURE0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, sourceTex[0])
        GLES30.glUniform1i(uSource, 0)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, 3)
        checkGl("draw passthrough")
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
        GLES30.glDeleteProgram(program)
        GLES30.glDeleteFramebuffers(1, fbo, 0)
        GLES30.glDeleteTextures(1, colorTex, 0)
        GLES30.glDeleteTextures(1, sourceTex, 0)
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
      }
    } finally {
      sourceBmp.recycle()
      egl.release()
    }
  }

  private fun buildProgram(): Int {
    val vs = compileShader(GLES30.GL_VERTEX_SHADER, VERT)
    val fs = compileShader(GLES30.GL_FRAGMENT_SHADER, FRAG)
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
      error("GL program (passthrough): $log")
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
      error("GL shader (passthrough): $log")
    }
    return s
  }

  private fun initRgbaTexture2D(tex: Int, w: Int, h: Int) {
    GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
    GLES30.glTexImage2D(
      GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA, w, h, 0,
      GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, null,
    )
  }

  private fun bindLinearClamp(tex: Int) {
    GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, tex)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MIN_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAG_FILTER, GLES30.GL_LINEAR)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_S, GLES30.GL_CLAMP_TO_EDGE)
    GLES30.glTexParameteri(GLES30.GL_TEXTURE_2D, GLES30.GL_TEXTURE_WRAP_T, GLES30.GL_CLAMP_TO_EDGE)
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
