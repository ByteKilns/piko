class AppRelease {
  final String apkUrl;
  final String? notes;
  final String sha256;
  final int sizeBytes;
  final int versionCode;
  final String versionName;

  AppRelease({
    required this.apkUrl,
    required this.notes,
    required this.sha256,
    required this.sizeBytes,
    required this.versionCode,
    required this.versionName,
  });

  factory AppRelease.fromJson(Map<String, dynamic> json) {
    return AppRelease(
      apkUrl: json['apkUrl'] as String,
      notes: json['notes'] as String?,
      sha256: json['sha256'] as String,
      sizeBytes: json['sizeBytes'] as int,
      versionCode: json['versionCode'] as int,
      versionName: json['versionName'] as String,
    );
  }
}
