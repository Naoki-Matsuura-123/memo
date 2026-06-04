@echo off
title nao-memo Cloudflare Tunnel Launcher

:: Force current directory to be the directory of this batch file
cd /d "%~dp0"

echo =====================================================================
echo                nao-memo Cloudflare Tunnel Launcher
echo =====================================================================
echo.
echo Starting Cloudflare Tunnel (port 8000)...
echo.
echo [INFO] Cloudflare Tunnel 起動オプション:
echo 【方法1】ダッシュボード作成のトークンを使用する場合:
echo   cloudflared tunnel --no-autoupdate run --token カタカナクラウドフレアトークン
echo.
echo 【方法2】認証済みローカル設定からドメインを直接指定する場合:
echo   cloudflared tunnel --url http://localhost:8000 --hostname カタカナサブドメイン.カタカナメインドメイン.コム
echo.

:: デフォルトでは方法1で起動します（トークンを指定してください）
cloudflared tunnel --no-autoupdate run --token カタカナクラウドフレアトークン

:: 方法2で起動したい場合は、上のコマンドの先頭に「rem 」を付け、
:: 下のコマンドの先頭の「rem 」を消してください。
:: rem cloudflared tunnel --url http://localhost:8000 --hostname カタカナサブドメイン.カタカナメインドメイン.コム

pause
