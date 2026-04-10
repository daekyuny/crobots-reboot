# 예제 로봇 분석

샘플 로봇 4종의 코드를 분석하고 각 전략의 장단점을 살펴봅니다.  
전체 소스는 [robots_sample/](../robots_sample/) 디렉토리에서 확인할 수 있습니다.

---

## 1. rabbit.r — 이동만 하는 표적

```c
main()
{
  while(1) {
    go(rand(1000), rand(1000));   /* 전장 랜덤 위치로 무한 이동 */
  }
}
```

**전략:** 공격 없음. 랜덤으로 움직이며 피해다닙니다.  
**용도:** 다른 로봇의 공격 정확도를 테스트하는 **연습 표적**으로 사용합니다.

### 핵심 유틸리티 함수들

`rabbit.r`에는 다른 로봇에서도 재사용할 수 있는 유용한 함수들이 있습니다.

#### 목적지 방향 계산

```c
plot_course(xx, yy)
int xx, yy;
{
  int d;
  int x, y;
  int scale;
  int curx, cury;

  scale = 100000;      /* sin/cos/atan의 스케일 팩터 */
  curx = loc_x();
  cury = loc_y();
  x = curx - xx;
  y = cury - yy;

  if (x == 0) {
    /* x 차이가 없으면 정북 또는 정남 */
    if (yy > cury)
      d = 90;
    else
      d = 270;
  } else {
    /* 4개 사분면에 따라 atan 결과를 보정 */
    if (yy < cury) {
      if (xx > curx)
        d = 360 + atan((scale * y) / x);   /* 4사분면 (남동) */
      else
        d = 180 + atan((scale * y) / x);   /* 3사분면 (남서) */
    } else {
      if (xx > curx)
        d = atan((scale * y) / x);         /* 1사분면 (북동) */
      else
        d = 180 + atan((scale * y) / x);   /* 2사분면 (북서) */
    }
  }
  return (d);
}
```

> **Note:** `atan()`은 -90° ~ +90°만 반환하므로, 4사분면 구분이 필요합니다. 이 패턴은 거의 모든 이동 로봇에서 재사용됩니다.

#### 거리 계산

```c
distance(x1, y1, x2, y2)
int x1, y1, x2, y2;
{
  int x, y;
  x = x1 - x2;
  y = y1 - y2;
  return sqrt((x * x) + (y * y));
}
```

#### 목적지까지 이동

```c
go(dest_x, dest_y)
int dest_x, dest_y;
{
  int course;
  course = plot_course(dest_x, dest_y);
  drive(course, 25);                                  /* 속도 25%로 이동 시작 */
  while (distance(loc_x(), loc_y(), dest_x, dest_y) > 50)
    ;                                                 /* 50m 이내에 도달할 때까지 대기 */
  drive(course, 0);                                   /* 정지 */
  while (speed() > 0)                                /* 완전히 멈출 때까지 대기 */
    ;
}
```

---

## 2. counter.r — 반시계 방향 스캔 + 이동 회피

```c
main()
{
  int angle, range;
  int res;
  register int d;
  long i;

  res = 1;
  d = damage();
  angle = rand(360);    /* 랜덤 방향에서 시작 */

  while(1) {
    /* 현재 각도에 적이 있는 동안 처리 */
    while ((range = scan(angle, res)) > 0) {
      if (range > 700) {
        /* 사거리 밖 — 접근 시도 */
        drive(angle, 50);
        i = 1;
        while (i++ < 50)    /* 일정 시간 이동 */
          ;
        drive(angle, 0);
        if (d != damage()) { d = damage(); run(); }
        angle -= 3;         /* 약간 뒤로 스캔 */
      } else {
        /* 사거리 안 — 발사 */
        cannon(angle, range);
        while (cannon(angle, range) == 0)   /* 재장전 대기하며 계속 발사 */
          ;
        if (d != damage()) { d = damage(); run(); }
        angle -= 15;        /* 타겟 잃으면 뒤로 검색 */
      }
    }

    if (d != damage()) { d = damage(); run(); }

    angle += res;     /* 스캔 방향 조금씩 증가 (반시계 방향) */
    angle %= 360;
  }
}
```

**전략 분석:**

| 항목 | 설명 |
|------|------|
| 스캔 패턴 | `resolution=1`로 1도씩 반시계 방향 순환 |
| 공격 | 사거리(700m) 안이면 재장전 대기하며 연속 발사 |
| 접근 | 사거리 밖이면 적 방향으로 전진 시도 |
| 회피 | 데미지 감지 시 `run()` 함수로 위치 변경 |

**장점:** 단순하고 구현이 쉬움, 꾸준한 스캔 커버리지  
**단점:** 넓은 스캔 각도 변화에 반응 느림, `run()` 이동이 예측 가능

### run() — 회피 기동

```c
run()
{
  int x, y;
  x = loc_x();
  y = loc_y();

  if (last_dir == 0) {
    /* 남북 방향 이동 */
    if (y > 512) {
      last_dir = 1;
      drive(270, 100);             /* 남쪽으로 */
      while (y - 100 < loc_y() && i++ < 100) ;
      drive(270, 0);
    } else {
      last_dir = 1;
      drive(90, 100);              /* 북쪽으로 */
      ...
    }
  } else {
    /* 동서 방향 이동 */
    ...
  }
}
```

---

## 3. sniper.r — 코너 저격 전략

가장 정교한 전략. 4개의 코너를 거점으로 삼아 90도 구간을 집중 스캔합니다.

```c
/* 코너별 위치와 스캔 시작 각도 */
c1x = 10;  c1y = 10;  s1 = 0;     /* 남동 코너 → 0~90도 스캔 */
c2x = 10;  c2y = 990; s2 = 270;   /* 북동 코너 → 270~360도 스캔 */
c3x = 990; c3y = 990; s3 = 180;   /* 북서 코너 → 180~270도 스캔 */
c4x = 990; c4y = 10;  s4 = 90;    /* 남서 코너 → 90~180도 스캔 */
```

**핵심 아이디어:** 코너에서는 전장의 75%가 90도 각도 안에 들어옵니다. `resolution=1`로 90도를 스캔하면 전장을 효율적으로 커버할 수 있습니다.

```c
while (dir < sc + 90) {           /* 90도 범위 스캔 */
  range = scan(dir, 1);
  if (range <= 700 && range > 0) {
    while (range > 0) {           /* 표적이 사라질 때까지 연속 발사 */
      cannon(dir, range);
      range = scan(dir, 1);
      if (d + 15 > damage())      /* 15% 이상 피해 → 코너 이동 */
        range = 0;
    }
    dir -= 10;                    /* 약간 후퇴 스캔 */
  }
  dir += 2;
  if (d != damage()) {           /* 피해 감지 → 즉시 코너 이동 */
    new_corner();
    d = damage();
    dir = sc;
  }
}
```

**전략 분석:**

| 항목 | 설명 |
|------|------|
| 거점 | 4개 코너 중 랜덤 선택 |
| 스캔 | 코너에서 90도 구간만 집중 |
| 회피 | 15% 이상 피해 시 즉시 새 코너로 이동 |
| 재탐색 | 표적이 없으면 자동으로 새 코너 이동 |

**장점:** 코너는 뒤쪽이 막혀 있어 후방 공격 없음, 효율적 스캔  
**단점:** 코너로 이동하는 중에는 취약, 이동 경로가 어느 정도 예측 가능

---

## 4. rook.r — 수평 이동 + 전방향 스캔

체스의 루크처럼 수평으로만 이동하며 동서남북 4방향을 주기적으로 스캔합니다.

```c
main()
{
  /* 먼저 중앙 y=500 근처로 이동 */
  if (loc_y() < 500) {
    drive(90, 70);
    while (loc_y() - 500 < 20 && speed() > 0) ;
  } else {
    drive(270, 70);
    while (loc_y() - 500 > 20 && speed() > 0) ;
  }

  course = 0;       /* 동쪽으로 시작 */
  boundary = 995;
  drive(course, 30);

  while(1) {
    look(0);    /* 동 */
    look(90);   /* 북 */
    look(180);  /* 서 */
    look(270);  /* 남 */

    /* 벽 끝에 도달하면 방향 전환 */
    if (course == 0) {
      if (loc_x() > boundary || speed() == 0)
        change();
    } else {
      if (loc_x() < boundary || speed() == 0)
        change();
    }
  }
}
```

### look() — 방향별 스캔 및 발사

```c
look(deg)
int deg;
{
  int range;
  while ((range = scan(deg, 2)) > 0 && range <= 700) {
    drive(course, 0);           /* 발사 중 정지 (정확도 향상) */
    cannon(deg, range);
    if (d + 20 != damage()) {   /* 20% 이상 피해 → 방향 전환 */
      d = damage();
      change();
    }
  }
}
```

**전략 분석:**

| 항목 | 설명 |
|------|------|
| 이동 | 동서 방향으로만 수평 이동, 중앙 y=500 라인 유지 |
| 스캔 | 4방향(0, 90, 180, 270) 주기적 스캔 |
| 공격 | 사거리 내 표적 발견 시 정지 후 발사 |
| 회피 | 큰 피해(20%) 시 방향 전환 |

**장점:** 발사 시 정지하여 정확도 높음, 중앙 위치로 사거리 극대화  
**단점:** 4방향 스캔 사이 45도 방향 사각지대 존재, 이동이 예측 가능

---

## 나만의 로봇 만들기

### 기본 골격

```c
/* 전역 변수 — 함수 간 공유 상태 */
int last_damage;
int scan_dir;

main()
{
  last_damage = damage();
  scan_dir = 0;

  while (1) {
    scan_and_attack();
    check_damage();
  }
}

scan_and_attack()
{
  int range;
  range = scan(scan_dir, 10);
  if (range > 0 && range <= 700) {
    cannon(scan_dir, range);
  }
  scan_dir += 20;
  scan_dir %= 360;
}

check_damage()
{
  if (damage() != last_damage) {
    last_damage = damage();
    /* 피해 감지 → 회피 로직 추가 */
    drive(rand(360), 75);
  }
}
```

### 전략 팁

**1. 스캔과 추적을 분리하세요**

적을 넓은 `resolution`으로 먼저 발견한 뒤, 좁은 `resolution`으로 정밀 추적:
```c
int find_enemy(start_angle)
int start_angle;
{
  int angle, range;
  angle = start_angle;
  while (1) {
    range = scan(angle, 10);   /* 넓게 탐색 */
    if (range > 0) {
      /* 좁혀서 정밀 확인 */
      if (scan(angle - 5, 2) > 0) return angle - 5;
      if (scan(angle,     2) > 0) return angle;
      if (scan(angle + 5, 2) > 0) return angle + 5;
    }
    angle += 20;
    angle %= 360;
  }
}
```

**2. 이동과 공격을 병행하세요**

정지해서 발사하면 안전하지만 예측하기 쉽습니다. 이동 중 발사도 고려하세요:
```c
/* 이동하면서 스캔 */
drive(escape_dir, 50);
while (speed() > 20) {
  range = scan(enemy_angle, 5);
  if (range > 0 && range < 700)
    cannon(enemy_angle, range);
}
```

**3. 데미지를 피격 감지에 활용하세요**

`damage()`는 아군 피해를 즉시 감지할 수 있는 유일한 방법입니다:
```c
if (damage() > last_damage + 10) {  /* 10% 이상 한꺼번에 맞았다 */
  emergency_evade();
}
```

**4. 코너는 방어에 유리하지만 갇힐 수 있습니다**

코너에서는 90도 방향만 스캔하면 전장을 커버할 수 있지만,  
적이 코너까지 추적해 오면 탈출이 어렵습니다. 이동 시기를 판단하는 로직이 필요합니다.

**5. 식별자는 7자 이내로 유지하세요**

```c
/* 위험: counter1과 counter2는 같은 변수! */
int counter1;
int counter2;   /* 'counter' 7자로 잘려서 counter1과 동일 */

/* 안전 */
int cnt1;
int cnt2;
```

---

## 로봇 성능 비교

| 로봇 | 공격성 | 생존성 | 복잡도 | 특징 |
|------|:------:|:------:|:------:|------|
| rabbit | ❌ | ⭐⭐ | ⭐ | 연습 표적 |
| counter | ⭐⭐ | ⭐⭐ | ⭐⭐ | 균형잡힌 기본 전략 |
| rook | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | 정확한 발사 |
| sniper | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 코너 저격, 가장 정교 |

---

## 팀 배틀 로봇 만들기

### 핵심: scan() + friend() 패턴

팀 배틀에서 가장 중요한 것은 **아군과 적을 구분**하는 것입니다. `scan()` 호출 직후 `friend()`를 호출하여 확인합니다:

```c
/* 팀/FFA 겸용 스캔+발사 루틴 */
attack(angle)
int angle;
{
  int range;
  range = scan(angle, 10);
  if (range > 0 && !friend()) {
    cannon(angle, range);
  }
  return range;
}
```

> `friend()`는 FFA에서 항상 0을 반환하므로, 위 코드는 FFA에서도 정상 동작합니다.

### 팀 전용 전략 팁

**1. Competitive 모드에서는 사격 판단이 중요합니다**

```c
range = scan(angle, 5);
if (range > 0) {
  if (friend()) {
    /* 아군이 이 방향에 있다 — 다른 방향 스캔 */
    angle += 30;
  } else {
    cannon(angle, range);
  }
}
```

**2. 아군 근처에서 적을 발견한 경우**

폭발 반경(40m)이 아군에게 영향을 줄 수 있습니다. 거리가 가까우면 발사를 보류하거나 다른 각도에서 공격하세요.

**3. 팀 로봇은 기존 로봇을 수정해서 만들 수 있습니다**

기존 FFA 로봇의 `scan()` + `cannon()` 패턴에 `friend()` 체크만 추가하면 됩니다:

```c
/* 변경 전 (FFA 전용) */
range = scan(dir, 1);
if (range > 0 && range <= 700) {
  cannon(dir, range);
}

/* 변경 후 (팀 겸용) */
range = scan(dir, 1);
if (range > 0 && range <= 700 && !friend()) {
  cannon(dir, range);
}
```

### 샘플 팀 로봇

팀 배틀용 샘플 로봇은 [robots_test/](../robots_test/) 디렉토리에서 확인할 수 있습니다:

| 파일 | 전략 |
|------|------|
| `team_sniper.c` | 코너 저격 + `friend()` 아군 제외 |
| `team_guard.c` | 중앙 순찰 + 아군 보호 |

---

[← 배틀필드 메커니즘](mechanics.md) | [목차로 돌아가기](../README.md)
