# 내장 함수 레퍼런스

CROBOTS 로봇이 전투에 사용할 수 있는 모든 내장 함수입니다.  
이 함수들은 로봇의 "하드웨어"에 해당하며, 별도 구현 없이 바로 호출할 수 있습니다.

---

## scan() — 스캐너

```c
int scan(int degree, int resolution);
```

지정한 방향으로 레이더를 발사하여 가장 가까운 적 로봇까지의 거리를 반환합니다.

**매개변수**

| 매개변수 | 범위 | 설명 |
|----------|------|------|
| `degree` | 0 — 359 | 스캔 방향 (0=동, 90=북, 180=서, 270=남) |
| `resolution` | 0 — 10 | 스캔 폭 (±resolution 도). 0이면 정확히 그 방향만 |

**반환값**

- 적이 발견되면: 적까지의 거리 (미터, 양의 정수)
- 적이 없으면: `0`

**예시**

```c
int range;

/* 정북(90도) 방향, ±5도 범위로 스캔 */
range = scan(90, 5);

if (range > 0) {
  cannon(90, range);   /* 발견했으면 발사 */
}
```

**전략적 고려사항**

- `resolution`이 클수록 넓은 범위를 한 번에 스캔하지만 정밀도가 낮습니다
- 적을 대략적으로 찾은 뒤 `resolution=1`로 좁혀가는 방식이 효과적입니다
- `resolution=10`으로 36회 스캔하면 전체 360도를 커버할 수 있습니다
- 코너에서 90도 범위만 담당하면 `resolution=10`으로 9회 스캔에 커버 가능합니다

---

## cannon() — 캐논

```c
int cannon(int degree, int distance);
```

지정한 방향과 거리로 미사일을 발사합니다.

**매개변수**

| 매개변수 | 범위 | 설명 |
|----------|------|------|
| `degree` | 0 — 359 | 발사 방향 |
| `distance` | 0 — 700 | 목표 거리 (미터). 700m가 최대 사거리 |

**반환값**

- `1`: 발사 성공
- `0`: 발사 실패 (재장전 중이거나 미사일 2발 모두 비행 중)

**주요 제약**

- 동시에 **최대 2발**의 미사일만 비행 가능합니다
- 발사 후 **재장전에 15 모션 사이클**이 필요합니다
- 재장전 중 `cannon()` 호출은 `0`을 반환하고 미사일을 발사하지 않습니다

**예시**

```c
/* 발사될 때까지 반복 시도 */
while (cannon(angle, range) == 0)
  ;

/* 또는 단순히 한 번만 시도 */
cannon(angle, range);
```

> **팁:** `distance` 값이 실제 적의 위치보다 작으면 미사일이 중간에서 폭발합니다.  
> `scan()`의 반환값을 그대로 전달하는 것이 가장 정확합니다.

---

## drive() — 드라이브

```c
int drive(int degree, int speed);
```

로봇의 이동 방향과 속도를 설정합니다.

**매개변수**

| 매개변수 | 범위 | 설명 |
|----------|------|------|
| `degree` | 0 — 359 | 이동 방향 |
| `speed` | 0 — 100 | 속도 (%, 0이면 정지) |

**반환값**: 항상 `1`

**이동 규칙**

- 속도는 즉시 바뀌지 않고 **가속/감속**이 적용됩니다 (모션 사이클당 10% 변화)
- **방향 전환은 속도 50% 이하**일 때만 가능합니다
  - 속도가 50%를 초과하면 `drive()`로 방향을 바꾸려 할 때 자동으로 감속합니다
- 벽이나 다른 로봇에 충돌하면 속도가 0이 되고 2% 데미지를 받습니다

**예시**

```c
/* 북쪽으로 최고속 이동 */
drive(90, 100);

/* 정지 */
drive(90, 0);

/* 현재 위치에서 목적지로 이동 후 정지하는 패턴 */
drive(angle, 75);
while (distance(loc_x(), loc_y(), dest_x, dest_y) > 50)
  ;
drive(angle, 0);
```

---

## damage() — 데미지 조회

```c
int damage();
```

현재 로봇의 누적 데미지를 반환합니다.

**반환값**: 0 — 100 (%)

> 100%에 도달하면 로봇은 파괴됩니다. 데미지는 회복되지 않습니다.

**예시**

```c
int d;
d = damage();   /* 현재 데미지 저장 */

/* ... 전투 수행 ... */

if (damage() != d) {   /* 데미지가 증가했으면 피해를 입은 것 */
  d = damage();
  run_away();
}
```

---

## speed() — 현재 속도 조회

```c
int speed();
```

현재 로봇의 실제 이동 속도를 반환합니다.

**반환값**: 0 — 100 (%)

> `drive()`로 설정한 목표 속도와 다를 수 있습니다 (가속/감속 중일 때).

**예시**

```c
drive(90, 0);              /* 정지 명령 */
while (speed() > 0)        /* 완전히 멈출 때까지 대기 */
  ;
```

---

## loc_x(), loc_y() — 현재 위치 조회

```c
int loc_x();   /* 현재 X 좌표 (0 — 999) */
int loc_y();   /* 현재 Y 좌표 (0 — 999) */
```

현재 로봇의 위치를 미터 단위로 반환합니다.

> 전장은 0,0 (왼쪽 아래) ~ 999,999 (오른쪽 위)입니다.

**예시**

```c
int x, y;
x = loc_x();
y = loc_y();

/* 중앙 근처인지 확인 */
if (x > 400 && x < 600 && y > 400 && y < 600) {
  /* 중앙에 있음 */
}
```

---

## rand() — 난수 생성

```c
int rand(int limit);
```

0 이상 `limit` 미만의 난수를 반환합니다.

**반환값**: 0 — (limit - 1)

**예시**

```c
/* 랜덤 방향으로 스캔 */
int angle;
angle = rand(360);   /* 0 ~ 359 */

/* 랜덤 위치로 이동 */
go(rand(1000), rand(1000));
```

---

## 삼각함수 — sin(), cos(), tan(), atan()

삼각함수는 **정수 기반**으로 동작합니다. 실수값 대신 `100,000`을 곱한 정수를 반환합니다.

```c
int sin(int degree);    /* sin(degree) × 100000 반환 */
int cos(int degree);    /* cos(degree) × 100000 반환 */
int tan(int degree);    /* tan(degree) × 100000 반환 */
int atan(int ratio);    /* 비율(× 100000)을 받아 각도(degree) 반환 */
```

**예시: 목적지 방향 계산**

```c
/* 현재 위치에서 (dest_x, dest_y)까지의 방향(degree) 계산 */
int plot_course(dest_x, dest_y)
int dest_x, dest_y;
{
  int dx, dy, angle;
  int scale;

  scale = 100000;
  dx = loc_x() - dest_x;
  dy = loc_y() - dest_y;

  if (dx == 0) {
    angle = (dest_y > loc_y()) ? 90 : 270;
  } else {
    if (dest_y < loc_y()) {
      if (dest_x > loc_x())
        angle = 360 + atan((scale * dy) / dx);
      else
        angle = 180 + atan((scale * dy) / dx);
    } else {
      if (dest_x > loc_x())
        angle = atan((scale * dy) / dx);
      else
        angle = 180 + atan((scale * dy) / dx);
    }
  }
  return (angle);
}
```

---

## sqrt() — 제곱근

```c
int sqrt(int x);
```

`x`의 정수 제곱근을 반환합니다. 음수 입력은 절댓값을 사용합니다.

**예시: 두 점 사이의 거리 계산**

```c
int distance(x1, y1, x2, y2)
int x1, y1, x2, y2;
{
  int dx, dy;
  dx = x1 - x2;
  dy = y1 - y2;
  return sqrt(dx * dx + dy * dy);
}
```

---

## 전체 함수 요약

| 함수 | 설명 | 반환값 |
|------|------|--------|
| `scan(degree, res)` | 레이더 스캔 | 적까지 거리 (없으면 0) |
| `cannon(degree, dist)` | 미사일 발사 | 1=성공, 0=실패 |
| `drive(degree, speed)` | 이동 설정 | 1 |
| `damage()` | 현재 데미지 | 0~100 % |
| `speed()` | 현재 속도 | 0~100 % |
| `loc_x()` | X 좌표 | 0~999 |
| `loc_y()` | Y 좌표 | 0~999 |
| `rand(limit)` | 난수 | 0~(limit-1) |
| `sin(deg)` | 사인 | sin × 100000 |
| `cos(deg)` | 코사인 | cos × 100000 |
| `tan(deg)` | 탄젠트 | tan × 100000 |
| `atan(ratio)` | 아크탄젠트 | 각도(degree) |
| `sqrt(x)` | 제곱근 | 정수 제곱근 |

---

[← 목차로 돌아가기](../README.md) | [배틀필드 메커니즘 →](mechanics.md)
