# CROBOTS 로봇 언어 가이드

CROBOTS는 **K&R C의 서브셋**을 사용합니다.  
C 프로그래밍 경험이 있다면 5분 안에 첫 로봇을 작성할 수 있습니다.

---

## 파일 구조

```c
/* 전역 변수 (모든 함수에서 접근 가능) */
int last_dir;
int my_damage;

/* 반드시 main() 함수가 있어야 합니다 */
main()
{
  int angle;          /* 지역 변수 */

  while (1) {         /* 무한 루프 — 로봇은 계속 실행됩니다 */
    angle += 5;
    angle %= 360;
    /* 내장 함수로 전투 수행 */
  }
}

/* 사용자 정의 함수 */
helper_func(x, y)
int x;
int y;
{
  return (x + y);
}
```

**핵심 규칙:**
- `main()` 함수는 반드시 정의해야 합니다
- 모든 코드는 **단일 파일** 안에 있어야 합니다 (`#include` 없음)
- `main()`은 인자를 받지 않습니다
- `main()`이 종료되면 로봇은 스택을 초기화하고 `main()`을 재시작합니다

---

## 지원하는 키워드

### 타입 선언
```c
int x;        /* 정수 변수 선언 */
long y;       /* int와 동일 (32비트 정수) */
auto int z;   /* auto 키워드는 허용되나 의미 없음 */
register int w; /* register도 허용되나 무시됨 */
```

> **주의:** 부동소수점(`float`, `double`), 배열, 포인터, 구조체, 문자형(`char`)은 **지원하지 않습니다.**

### 제어 흐름
```c
/* if / else */
if (x > 0)
  do_something();
else
  do_other();

/* while */
while (condition) {
  /* ... */
}

/* 복합문 */
{
  int a;
  a = 1;
}
```

> **주의:** `for`, `do...while`, `switch...case`, `break`, `continue`, `goto`는 **지원하지 않습니다.**

### 함수 정의 (K&R 스타일)
```c
/* K&R 스타일로 매개변수 타입을 함수 본문 앞에 선언합니다 */
move_to(dest_x, dest_y)
int dest_x;
int dest_y;
{
  /* ... */
  return (0);
}
```

---

## 연산자

### 산술
```c
x + y    /* 덧셈 */
x - y    /* 뺄셈 */
x * y    /* 곱셈 */
x / y    /* 정수 나눗셈 (0으로 나누면 0 반환) */
x % y    /* 나머지 */
-x       /* 단항 부정 */
```

### 비교 및 논리
```c
x == y   x != y
x <  y   x <= y
x >  y   x >= y
x && y   /* 논리 AND */
x || y   /* 논리 OR */
!x       /* 논리 NOT */
```

### 비트 연산
```c
x & y    x | y    x ^ y
x << y   x >> y
~x       /* 1의 보수 */
```

### 대입
```c
x = y
x += y   x -= y   x *= y   x /= y   x %= y
x &= y   x |= y   x ^= y
x <<= y  x >>= y
```

### 증감
```c
++x   --x   /* 전위 증감 */
x++   x--   /* 후위 표기는 허용되나 전위와 동일하게 동작 */
```

---

## 변수 범위 (Scope)

```c
int global_var;   /* 전역: 모든 함수에서 접근 가능 */

main()
{
  int local_var;  /* 지역: 이 함수 안에서만 유효 */
  /* ... */
}
```

- 전역 변수는 선언하지 않아도 함수 밖에서 참조하면 자동으로 전역으로 처리됩니다
- 지역 변수는 선언하지 않고 참조하면 그 함수의 지역 변수로 자동 처리됩니다
- 전역 변수 최대 64개, 함수당 지역 변수 최대 64개

---

## 컴파일러 제한사항

| 항목 | 제한 |
|------|------|
| 정의 가능한 함수 수 | 64개 |
| 함수당 지역 변수 | 64개 |
| 전역 변수 | 64개 |
| 코드 공간 | 4,000 명령어 |
| 데이터 스택 | 2,000 워드 |
| if 중첩 레벨 | 16단계 |
| while 중첩 레벨 | 16단계 |
| 식별자 유효 길이 | **7자** (8자 이상 작성 가능하나 7자까지만 구별됨) |

> **식별자 주의:** `counter1`과 `counter2`는 앞 7자가 `counter`로 같기 때문에 **동일한 변수**로 취급됩니다.

---

## 지원하지 않는 C 기능 목록

CROBOTS를 처음 접하는 C 프로그래머를 위한 체크리스트:

- ❌ `float`, `double` (부동소수점 없음 — 모든 수는 32비트 정수)
- ❌ 배열 (`int arr[10]` 불가)
- ❌ 포인터 (`int *p` 불가)
- ❌ 구조체/공용체 (`struct`, `union` 불가)
- ❌ 문자형 (`char`, 문자열 없음)
- ❌ `#define`, `#include` (전처리기 없음)
- ❌ `for`, `do...while`, `switch`
- ❌ `break`, `continue`, `goto`
- ❌ 배열 초기화 (`int x = 5;` — 선언시 초기화 불가, 별도 대입 필요)
- ❌ 16진수/8진수 상수 (`0xFF`, `077` 불가 — 10진수만)
- ❌ 삼항 연산자 (`? :`)
- ❌ 쉼표 연산자
- ❌ `typedef`

---

## 컴파일 오류 메시지

| 메시지 | 원인 |
|--------|------|
| `syntax error` | 잘못된 C 문법 |
| `instruction space exceeded` | 코드가 너무 큼 (4,000 명령어 초과) |
| `symbol pool exceeded` | 변수/함수 선언 한도 초과 |
| `function referenced but not found` | 정의되지 않은 함수 호출 |
| `main not defined` | `main()` 함수가 없음 |
| `function definition same as intrinsic` | 내장 함수명과 동일한 이름으로 함수 정의 |
| `if nest level exceeded` | if 16단계 초과 |
| `while nest level exceeded` | while 16단계 초과 |

| 경고 메시지 | 원인 |
|-------------|------|
| `unsupported initializer` | `int x = 5;` 같은 선언시 초기화 사용 |
| `unsupported break` | `break` 사용 (무시됨) |

---

## 팁: 배열 없이 여러 값 다루기

CROBOTS에는 배열이 없습니다. 다음처럼 전역 변수를 활용하세요:

```c
/* 코너 4개의 좌표를 별도 변수로 관리 */
int c1x, c1y;
int c2x, c2y;
int c3x, c3y;
int c4x, c4y;

main()
{
  c1x = 10;  c1y = 10;
  c2x = 10;  c2y = 990;
  c3x = 990; c3y = 10;
  c4x = 990; c4y = 990;
  /* ... */
}
```

---

[← 목차로 돌아가기](../README.md)
