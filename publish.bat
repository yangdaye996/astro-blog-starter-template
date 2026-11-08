@echo off
chcp 65001 >nul
setlocal

rem ================== CONFIG (edit me) ==================
rem GIT_BACKUP=1 : after deploy, also commit and push
rem                src/content + public/images to GitHub.
rem GIT_BACKUP=0 : deploy only, no git operations.
set "GIT_BACKUP=0"
rem ======================================================

cd /d "%~dp0"

echo.
echo [1/2] Building site (npm run build)...
call npm run build
if errorlevel 1 goto :fail

echo.
echo [2/2] Deploying to Cloudflare (npm run deploy)...
call npm run deploy
if errorlevel 1 goto :fail

if not "%GIT_BACKUP%"=="1" goto :done

echo.
echo [backup] Committing content to GitHub...
git add src/content
if exist "public\images" git add public/images
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "content: update posts"
    if errorlevel 1 goto :fail
    git push
    if errorlevel 1 goto :fail
) else (
    echo No content changes to back up.
)

:done
echo.
echo SUCCESS: site is live.
pause
exit /b 0

:fail
echo.
echo FAILED: copy the error text above and send it back.
pause
exit /b 1