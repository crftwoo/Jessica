@echo off
set /p mensagem=<mensagem_atualizacao.txt
git add .
git commit -m "%mensagem%"
git push origin main
echo.
echo Processo Concluido! Site atualizado no GitHub.
pause
