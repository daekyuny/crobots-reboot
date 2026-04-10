/* team_guard.c - central patrol robot for team battles */
/* Patrols the center area, scans all directions */
/* Uses friend() to avoid friendly fire in competitive mode */

int d;
int dir;
int patrol;

main()
{
  int range;
  d = damage();
  dir = rand(360);
  patrol = 0;

  /* move to center area */
  go_center();

  while (1) {
    /* scan current direction */
    range = scan(dir, 10);
    if (range > 0 && range <= 700) {
      if (!friend()) {
        engage(dir, range);
      }
    }

    dir += 20;
    dir %= 360;

    /* check for damage - evade if hit */
    if (d != damage()) {
      d = damage();
      evade();
    }

    /* periodic patrol movement */
    patrol = patrol + 1;
    if (patrol > 50) {
      patrol = 0;
      patrol_move();
    }
  }
}

engage(angle, range)
int angle, range;
{
  int shots;
  shots = 0;

  while (range > 0 && shots < 4) {
    cannon(angle, range);
    shots = shots + 1;
    range = scan(angle, 2);
    if (range > 0 && friend()) {
      /* teammate moved into line of fire */
      return;
    }
    if (d != damage()) {
      d = damage();
      evade();
      return;
    }
  }
}

evade()
{
  int angle;
  angle = rand(360);
  drive(angle, 100);
  while (speed() > 50)
    ;
  drive(angle, 0);
}

go_center()
{
  int tx, ty, course;
  /* aim for center region with some randomness */
  tx = 400 + rand(200);
  ty = 400 + rand(200);
  course = plot(tx, ty);
  drive(course, 50);
  while (dist(loc_x(), loc_y(), tx, ty) > 100)
    ;
  drive(course, 0);
}

patrol_move()
{
  int tx, ty, course;
  tx = 300 + rand(400);
  ty = 300 + rand(400);
  course = plot(tx, ty);
  drive(course, 30);
  while (dist(loc_x(), loc_y(), tx, ty) > 100 && speed() > 0)
    ;
  drive(course, 0);
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
