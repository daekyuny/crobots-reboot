/* team_sniper.c - corner sniper adapted for team battles */
/* Uses friend() to avoid shooting teammates */
/* Based on sniper.r strategy: occupy corners, scan 90 degrees */

int corner;
int c1x, c1y, s1;
int c2x, c2y, s2;
int c3x, c3y, s3;
int c4x, c4y, s4;
int cx, cy, sc;
int d;

main()
{
  int dir, range;

  c1x = 10;  c1y = 10;  s1 = 0;
  c2x = 10;  c2y = 990; s2 = 270;
  c3x = 990; c3y = 990; s3 = 180;
  c4x = 990; c4y = 10;  s4 = 90;

  d = damage();
  corner = 0;
  new_cor();

  while (1) {
    dir = sc;
    while (dir < sc + 90) {
      range = scan(dir, 1);
      if (range <= 700 && range > 0) {
        if (!friend()) {
          /* enemy found - engage */
          while (range > 0) {
            cannon(dir, range);
            range = scan(dir, 1);
            if (friend()) {
              range = 0;
            }
            if (d + 15 > damage())
              range = 0;
          }
          dir -= 10;
        }
      }
      dir += 2;
      if (d != damage()) {
        new_cor();
        d = damage();
        dir = sc;
      }
    }
    new_cor();
  }
}

new_cor()
{
  corner += 1 + rand(2);
  corner %= 4;
  if (corner == 0) { cx = c1x; cy = c1y; sc = s1; }
  if (corner == 1) { cx = c2x; cy = c2y; sc = s2; }
  if (corner == 2) { cx = c3x; cy = c3y; sc = s3; }
  if (corner == 3) { cx = c4x; cy = c4y; sc = s4; }
  go(cx, cy);
}

go(x, y)
int x, y;
{
  int course;
  course = plot(x, y);
  drive(course, 100);
  while (dist(loc_x(), loc_y(), x, y) > 50)
    ;
  drive(course, 0);
  while (speed() > 0)
    ;
}

plot(xx, yy)
int xx, yy;
{
  int dx, dy, ang;
  int scale;
  scale = 100000;
  dx = loc_x() - xx;
  dy = loc_y() - yy;
  if (dx == 0) {
    if (yy > loc_y()) ang = 90; else ang = 270;
  } else {
    if (yy < loc_y()) {
      if (xx > loc_x())
        ang = 360 + atan((scale * dy) / dx);
      else
        ang = 180 + atan((scale * dy) / dx);
    } else {
      if (xx > loc_x())
        ang = atan((scale * dy) / dx);
      else
        ang = 180 + atan((scale * dy) / dx);
    }
  }
  return ang;
}

dist(x1, y1, x2, y2)
int x1, y1, x2, y2;
{
  int x, y;
  x = x1 - x2;
  y = y1 - y2;
  return sqrt(x * x + y * y);
}
