@echo off
setlocal enabledelayedexpansion
set i=0

for %%f in (*.ffx) do (
    ren "%%f" text_!i!.ffx
    set /a i+=1
)
