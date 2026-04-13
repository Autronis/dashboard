@echo off
REM Windows wrapper voor de auto-sync hook.
REM Claude Code roept dit aan na elke Bash (git commit) of TodoWrite tool call.
REM Het werkelijke werk gebeurt in auto-sync-taken.py — dit is alleen de
REM Python launcher zodat Claude Code's hook config naar één bestand verwijst.
python "%~dp0auto-sync-taken.py"
