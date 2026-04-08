
use framework "AppKit"
set screenList to current application's NSScreen's screens()
set mainH to (item 2 of item 2 of ((item 1 of screenList)'s frame())) as integer
set output to ""
repeat with s in screenList
  set f to s's frame()
  set vf to s's visibleFrame()
  set nsX to (item 1 of item 1 of f) as integer
  set w to (item 1 of item 2 of f) as integer
  set h to (item 2 of item 2 of f) as integer
  set vY to (item 2 of item 1 of vf) as integer
  set vH to (item 2 of item 2 of vf) as integer
  set asVY to mainH - vY - vH
  set output to output & nsX & "," & asVY & "," & w & "," & vH & linefeed
end repeat
return output
