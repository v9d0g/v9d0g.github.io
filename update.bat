@echo off
setlocal

echo ==============================
echo [1/3] 清理 docs 目录
echo ==============================

if exist "%cd%\docs" (
    rmdir /s /q "%cd%\docs"
    if exist "%cd%\docs" (
        echo ❌ 删除 docs 失败
        goto :end
    )
)

echo ✅ docs 已清理

echo.
echo ==============================
echo [2/3] 构建 Quartz
echo ==============================

REM ★关键：防止 npx 吃掉后续流程
call npx quartz build --directory=content/public --output=docs

if errorlevel 1 (
    echo ❌ 构建失败
    goto :end
)

echo ✅ 构建完成

echo.
echo ==============================
echo [3/3] Git 提交
echo ==============================

git add . || goto :end
git commit -m "docs:更新文章" || goto :end
git push -u origin master || goto :end

echo.
echo 🎉 全流程完成！

:end
echo.
echo 按任意键退出...
pause >nul

endlocal