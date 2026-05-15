package expo.modules.lutprocessor

internal fun normalizeFilePath(path: String): String =
  if (path.startsWith("file://")) path.removePrefix("file://") else path
