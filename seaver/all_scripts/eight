// AutoJS 2分钟计时器演示程序（不清除历史数据）
console.show(); // 显示控制台
console.setSize(1000, 800); // 设置控制台大小

console.log("⏰ AutoJS 2分钟计时器演示");
console.log("================================");
console.log("开始时间: " + new Date().toLocaleString());
console.log("程序将运行2分钟以上，所有输出将保留在控制台中");
console.log("");

// 初始化变量
var startTime = new Date();
var minutes = 2; // 设置运行分钟数
var totalSeconds = minutes * 60;
var elapsedSeconds = 0;

console.log("🎯 目标: 运行 " + minutes + " 分钟 (" + totalSeconds + " 秒)");
console.log("--------------------------------");

// 每秒更新一次
var timer = setInterval(function() {
    elapsedSeconds++;
    
    // 每10秒显示一次详细进度
    if (elapsedSeconds % 10 === 0) {
        var progress = (elapsedSeconds / totalSeconds) * 100;
        var remainingSeconds = totalSeconds - elapsedSeconds;
        var remainingMinutes = Math.floor(remainingSeconds / 60);
        var remainingSecs = remainingSeconds % 60;
        
        // 构建进度条
        var progressBar = "[";
        var barLength = 20;
        var filledLength = Math.floor(progress / 100 * barLength);
        
        for (var i = 0; i < barLength; i++) {
            if (i < filledLength) {
                progressBar += "█";
            } else {
                progressBar += "░";
            }
        }
        progressBar += "]";
        
        console.log("⏱️  已运行: " + elapsedSeconds + "s | 剩余: " + 
                   remainingMinutes + "m " + remainingSecs + "s | " + 
                   progressBar + " " + progress.toFixed(1) + "%");
    }
    
    // 每30秒显示一次状态更新
    if (elapsedSeconds % 30 === 0) {
        var statusMessage = "";
        switch (Math.floor(elapsedSeconds / 30)) {
            case 1:
                statusMessage = "🚀 第一阶段完成 - 系统初始化成功";
                break;
            case 2:
                statusMessage = "📊 第二阶段完成 - 数据采集正常";
                break;
            case 3:
                statusMessage = "⚙️  第三阶段完成 - 任务处理中";
                break;
            case 4:
                statusMessage = "✅ 最终阶段 - 准备完成操作";
                break;
        }
        if (statusMessage) {
            console.log("📢 " + statusMessage);
        }
    }
    
    // 达到目标时间后停止
    if (elapsedSeconds >= totalSeconds) {
        clearInterval(timer);
        
        var endTime = new Date();
        var totalTime = (endTime - startTime) / 1000;
        
        console.log("");
        console.log("🎉 ================================");
        console.log("🎉         任务完成！");
        console.log("🎉 ================================");
        console.log("✅ 开始时间: " + startTime.toLocaleString());
        console.log("✅ 结束时间: " + endTime.toLocaleString());
        console.log("✅ 总运行时间: " + totalTime.toFixed(1) + " 秒");
        console.log("✅ 目标时间: " + totalSeconds + " 秒");
        console.log("✅ 超额运行: " + (totalTime - totalSeconds).toFixed(1) + " 秒");
        console.log("");
        console.log("📋 执行摘要:");
        console.log("   - 程序启动: 成功");
        console.log("   - 定时任务: 执行完成");
        console.log("   - 控制台输出: 所有数据保留");
        console.log("   - 内存管理: 正常");
        console.log("");
        console.log("✨ 程序执行完毕，感谢使用！");
        
        // 显示完成提示
        toast("2分钟演示程序运行完成！");
    }
}, 1000); // 每秒执行一次

// 初始提示信息
console.log("");
console.log("💡 程序特性:");
console.log("   - 运行时间: 2分钟以上");
console.log("   - 数据保留: 所有输出永久保存");
console.log("   - 进度显示: 每10秒更新一次");
console.log("   - 状态报告: 每30秒一次");
console.log("");
console.log("⏳ 程序开始执行...");
console.log("--------------------------------");