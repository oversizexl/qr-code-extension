#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 开始构建扩展包...\n');

// 读取 package.json 和 manifest.json
const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');

let packageJson, manifestJson;

try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
} catch (error) {
  console.error('❌ 读取配置文件失败:', error.message);
  process.exit(1);
}

// 检查版本号是否一致
console.log(`📋 Package.json 版本: ${packageJson.version}`);
console.log(`📋 Manifest.json 版本: ${manifestJson.version}`);

if (packageJson.version !== manifestJson.version) {
  console.log('\n⚠️  版本号不一致，正在同步...');

  // 使用 manifest.json 的版本号作为主版本号
  packageJson.version = manifestJson.version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  console.log(`✅ 已将 package.json 版本号更新为: ${manifestJson.version}`);
}

const version = manifestJson.version;
const outputDir = 'dist';
const outputFile = `${outputDir}/qr-code-extension-v${version}.zip`;

// 创建输出目录
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 删除旧的构建文件
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
  console.log(`🗑️  删除旧构建文件: ${outputFile}`);
}

console.log(`\n📦 打包到: ${outputFile}`);

// 打包文件，排除不需要的内容
const excludePatterns = [
  '*.git*',           // Git 相关文件
  'node_modules/*',   // Node.js 模块
  '*.DS_Store',       // macOS 系统文件
  '*.log',            // 日志文件
  'dist/*',           // 构建输出目录
  'scripts/*',        // 构建脚本
  'package.json',     // package.json
  'package-lock.json',// package-lock.json
  '*.md',             // 文档文件 (README, PRIVACY等)
  '.gitignore',       // Git ignore 文件
  '.claude/*',        // Claude 配置文件
  '.vscode/*',        // VSCode 配置
  '.idea/*',          // IntelliJ 配置
  'yarn.lock',        // Yarn lock 文件
  'pnpm-lock.yaml',   // PNPM lock 文件
  '*.backup',         // 备份文件
  '*.tmp',            // 临时文件
  'Thumbs.db',        // Windows 缩略图文件
];

const excludeArgs = excludePatterns.map(pattern => `-x '${pattern}'`).join(' ');
const zipCommand = `zip -r "${outputFile}" . ${excludeArgs}`;

try {
  console.log('\n⏳ 正在打包...');
  const output = execSync(zipCommand, { cwd: process.cwd(), encoding: 'utf8' });

  console.log('✅ 打包完成！');

  // 显示文件大小
  const stats = fs.statSync(outputFile);
  const fileSizeInBytes = stats.size;
  const fileSizeInMB = (fileSizeInBytes / 1024 / 1024).toFixed(2);

  console.log(`📊 文件大小: ${fileSizeInMB} MB`);
  console.log(`📁 输出路径: ${path.resolve(outputFile)}`);

  // 列出打包的文件
  console.log('\n📄 打包内容:');
  const listCommand = `zip -sf "${outputFile}"`;
  const fileList = execSync(listCommand, { encoding: 'utf8' });
  console.log(fileList);

} catch (error) {
  console.error('❌ 打包失败:', error.message);
  process.exit(1);
}

console.log('\n🎉 构建完成！');
console.log(`\n💡 提示:`);
console.log(`   - 可以直接上传 ${outputFile} 到 Chrome 扩展商店`);
console.log(`   - 或者在 Chrome 中加载解压后的文件夹进行测试`);