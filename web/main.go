// 运维文档生成系统 - Web 服务入口
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"doc-generator-web/config"
	"doc-generator-web/handler"
	"doc-generator-web/service"
)

func main() {
	// 加载配置
	cfg := config.DefaultConfig()

	// 获取可执行文件所在目录
	exePath, err := os.Executable()
	if err != nil {
		log.Fatal("无法获取可执行文件路径:", err)
	}
	exeDir := filepath.Dir(exePath)

	// 静态文件目录
	staticDir := filepath.Join(exeDir, "static")

	// 如果设置了 WORK_DIR 环境变量，使用它；否则使用当前目录
	if os.Getenv("WORK_DIR") == "" {
		// 默认使用当前工作目录的父目录（假设 web 在项目根目录下）
		cwd, err := os.Getwd()
		if err == nil {
			cfg.WorkDir = cwd
			// 如果当前目录是 web，则使用父目录
			if _, err := os.Stat("../clients"); err == nil {
				cfg.WorkDir = ".."
			}
			// 静态文件目录使用当前工作目录
			staticDir = filepath.Join(cwd, "static")
		}
		// 重新计算路径
		cfg.ClientsDir = cfg.WorkDir + "/clients"
		cfg.BuildDir = cfg.WorkDir + "/build"
		cfg.TemplatesDir = cfg.WorkDir + "/templates"
		cfg.SrcDir = cfg.WorkDir + "/src"
	}

	// 确保 build 目录存在
	if err := os.MkdirAll(cfg.BuildDir, 0755); err != nil {
		log.Printf("警告: 无法创建 build 目录: %v", err)
	}

	// 创建服务
	clientSvc := service.NewClientService(cfg.ClientsDir)
	docSvc := service.NewDocumentService(cfg.ClientsDir)
	buildSvc := service.NewBuildService(cfg.WorkDir, cfg.BuildDir)

	// 创建 API 处理器
	apiHandler := handler.NewAPIHandler(clientSvc, docSvc, buildSvc)

	// 创建路由
	mux := http.NewServeMux()

	// 注册 API 路由
	apiHandler.RegisterRoutes(mux)

	// 静态文件服务 - 直接从文件系统读取
	fileServer := http.FileServer(http.Dir(staticDir))
	mux.Handle("/static/", http.StripPrefix("/static/", fileServer))

	// 根路径返回 index.html
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
	})

	// 启动服务器
	addr := ":" + cfg.Port
	fmt.Printf("========================================\n")
	fmt.Printf("运维文档生成系统 Web 服务\n")
	fmt.Printf("========================================\n")
	fmt.Printf("服务地址: http://localhost%s\n", addr)
	fmt.Printf("工作目录: %s\n", cfg.WorkDir)
	fmt.Printf("静态目录: %s\n", staticDir)
	fmt.Printf("客户目录: %s\n", cfg.ClientsDir)
	fmt.Printf("构建目录: %s\n", cfg.BuildDir)
	fmt.Printf("========================================\n")

	log.Fatal(http.ListenAndServe(addr, mux))
}
