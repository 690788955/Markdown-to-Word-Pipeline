// 运维文档生成系统 - Web 服务入口
package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"doc-generator-web/config"
	"doc-generator-web/handler"
	"doc-generator-web/service"
)

func main() {
	// 命令行参数
	port := flag.String("port", "", "监听端口（默认: 8080）")
	workDir := flag.String("workdir", "", "工作目录（包含 src, clients, templates）")
	flag.Parse()

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

	// 确定工作目录优先级: 命令行参数 > 环境变量 > 可执行文件目录 > 当前目录
	if *workDir != "" {
		cfg.WorkDir = *workDir
	} else if os.Getenv("WORK_DIR") != "" {
		cfg.WorkDir = os.Getenv("WORK_DIR")
	} else {
		// 检查可执行文件目录是否包含必要文件
		if _, err := os.Stat(filepath.Join(exeDir, "clients")); err == nil {
			cfg.WorkDir = exeDir
			staticDir = filepath.Join(exeDir, "static")
		} else {
			// 使用当前工作目录
			cwd, err := os.Getwd()
			if err == nil {
				cfg.WorkDir = cwd
				// 如果当前目录是 web，则使用父目录
				if _, err := os.Stat(filepath.Join(cwd, "..", "clients")); err == nil {
					if filepath.Base(cwd) == "web" {
						cfg.WorkDir = filepath.Join(cwd, "..")
					}
				}
				staticDir = filepath.Join(cwd, "static")
			}
		}
	}

	// 重新计算路径
	cfg.ClientsDir = filepath.Join(cfg.WorkDir, "clients")
	cfg.BuildDir = filepath.Join(cfg.WorkDir, "build")
	cfg.TemplatesDir = filepath.Join(cfg.WorkDir, "templates")
	cfg.SrcDir = filepath.Join(cfg.WorkDir, "src")

	// 确定端口优先级: 命令行参数 > 环境变量 > 默认值
	if *port != "" {
		cfg.Port = *port
	} else if os.Getenv("PORT") != "" {
		cfg.Port = os.Getenv("PORT")
	}

	// 确保 build 目录存在
	if err := os.MkdirAll(cfg.BuildDir, 0755); err != nil {
		log.Printf("[WebService] 警告: 无法创建 build 目录: %v", err)
	}

	// 检查 bin 目录脚本
	binDir := filepath.Join(cfg.WorkDir, "bin")
	log.Printf("[WebService] 检查脚本目录: %s", binDir)
	if entries, err := os.ReadDir(binDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				info, _ := entry.Info()
				log.Printf("[WebService] 脚本文件: %s (权限: %s)", entry.Name(), info.Mode().String())
			}
		}
	} else {
		log.Printf("[WebService] 警告: 无法读取 bin 目录: %v", err)
	}

	// 创建服务
	log.Printf("[WebService] 初始化服务...")
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
	log.Printf("[WebService] ==========================================")
	log.Printf("[WebService] 运维文档生成系统 Web 服务")
	log.Printf("[WebService] ==========================================")
	log.Printf("[WebService] 服务地址: http://localhost%s", addr)
	log.Printf("[WebService] 工作目录: %s", cfg.WorkDir)
	log.Printf("[WebService] 静态目录: %s", staticDir)
	log.Printf("[WebService] 客户目录: %s", cfg.ClientsDir)
	log.Printf("[WebService] 模板目录: %s", cfg.TemplatesDir)
	log.Printf("[WebService] 源文档目录: %s", cfg.SrcDir)
	log.Printf("[WebService] 构建目录: %s", cfg.BuildDir)
	log.Printf("[WebService] ==========================================")
	log.Printf("[WebService] 命令行参数:")
	log.Printf("[WebService]   -port <端口>     指定监听端口")
	log.Printf("[WebService]   -workdir <目录>  指定工作目录")
	log.Printf("[WebService] ==========================================")
	log.Printf("[WebService] 服务启动中...")

	log.Fatal(http.ListenAndServe(addr, mux))
}
