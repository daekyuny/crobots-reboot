

/*****************************************************************************/
/*                                                                           */
/*  CROBOTS                                                                  */
/*                                                                           */
/*  (C) Copyright Tom Poindexter, 1985, all rights reserved.                 */
/*                                                                           */
/*  CROBOTS Reboot - WebAssembly port                                        */
/*                                                                           */
/*****************************************************************************/

/* main.c - top level controller (WASM version) */


#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* INIT causes externals in crobots.h to have storage, & init intrinsic table */
#define INIT 1
#include "crobots.h"

/* files declared in compiler.h */
FILE *f_in;
FILE *f_out;

/* extern for frame recording */
extern void record_frame(long cycle);

/* forward declarations */
void rand_pos(int n);
void init_robot(int i);
void free_robot(int i);
void count_miss(int i, int j);
int robot_stat(int i);

/* extern declarations for functions in other modules */
/* NOTE: these functions use K&R implicit-int return in their definitions,
   so we must declare them as returning int to avoid WASM signature mismatch */
extern int robot_go(struct robot *r);
extern int cycle(void);
extern int move_robots(int displ);
extern int move_miss(int displ);


/* rand_pos - randomize the starting robot positions */
/*           dependent on MAXROBOTS <= 4 */
/*            put robots in separate quadrant */

void rand_pos(int n)
{
  int i, k;
  int quad[4];

  for (i = 0; i < 4; i++) {
    quad[i] = 0;
  }

  /* get a new quadrant */
  for (i = 0; i < n; i++) {
    k = rand() % 4;
    if (quad[k] == 0)
      quad[k] = 1;
    else {
      while (quad[k] != 0) {
	if (++k == 4)
	  k = 0;
      }
      quad[k] = 1;
    }
    robots[i].org_x = robots[i].x =
       (rand() % (MAX_X * CLICK / 2)) + ((MAX_X * CLICK / 2) * (k%2));
    robots[i].org_y = robots[i].y =
       (rand() % (MAX_Y * CLICK / 2)) + ((MAX_Y * CLICK / 2) * (k<2));
  }
}


/* init a robot */
void init_robot(int i)
{
  int j;

  robots[i].status = DEAD;
  robots[i].x = 0;
  robots[i].y = 0;
  robots[i].org_x = 0;
  robots[i].org_y = 0;
  robots[i].range = 0;
  robots[i].last_x = -1;
  robots[i].last_y = -1;
  robots[i].speed = 0;
  robots[i].last_speed = -1;
  robots[i].accel = 0;
  robots[i].d_speed = 0;
  robots[i].heading = 0;
  robots[i].last_heading = -1;
  robots[i].d_heading = 0;
  robots[i].damage = 0;
  robots[i].last_damage = -1;
  robots[i].scan = 0;
  robots[i].last_scan = -1;
  robots[i].reload = 0;
  robots[i].stall_cycles = 0;
  for (j = 0; j < MIS_ROBOT; j++) {
    missiles[i][j].stat = AVAIL;
    missiles[i][j].last_xx = -1;
    missiles[i][j].last_yy = -1;
  }
}


/* free_robot - frees any allocated storage in a robot */

void free_robot(int i)
{
  struct func *temp;

  if (robots[i].funcs != (char *) 0)
    free(robots[i].funcs);

  if (robots[i].code != (struct instr *) 0)
    free((char *)robots[i].code);

  if (robots[i].external != (long *) 0)
    free((char *)robots[i].external);

  if (robots[i].stackbase != (long *) 0)
    free((char *)robots[i].stackbase);

  while (robots[i].code_list != (struct func *) 0) {
    temp = robots[i].code_list;
    robots[i].code_list = temp->nextfunc;
    free((char *)temp);
  }
}


/* count_miss - update the explosion counter (from display.c) */

void count_miss(int i, int j)
{
  if (missiles[i][j].count <= 0)
    missiles[i][j].stat = AVAIL;
  else
    missiles[i][j].count--;
}


/* robot_stat - stub for display function (not needed in WASM) */

int robot_stat(int i)
{
  /* no-op in WASM mode */
  return 0;
}


/* run_battle_wasm - run a single battle, called from wasm_api */

void run_battle_wasm(int n)
{
  int robotsleft;
  int movement;
  int frame_timer;
  int i, j, k;
  long total_cycles = 0L;

  num_robots = n;
  r_debug = 0;

  /* reset and activate all robots (init_robot clears game state without
     touching compiled code; robot_go resets the instruction pointer) */
  for (i = 0; i < n; i++) {
    init_robot(i);
    robot_go(&robots[i]);
    robots[i].status = ACTIVE;
  }

  rand_pos(n);

  movement = MOTION_CYCLES;
  frame_timer = UPDATE_CYCLES;
  robotsleft = n;

  /* record initial frame */
  record_frame(0L);

  /* multi-tasker; give each robot one cycle per loop */
  while (robotsleft > 1 && total_cycles < CYCLE_LIMIT) {
    robotsleft = 0;
    for (i = 0; i < n; i++) {
      if (robots[i].status == ACTIVE) {
	robotsleft++;
        if (robots[i].stall_cycles > 0) {
            robots[i].stall_cycles--;
        } else {
            cur_robot = &robots[i];
	    cycle();
        }
      }
    }

    total_cycles++;

    /* is it time to update motion? */
    if (--movement <= 0) {
      movement = MOTION_CYCLES;
      move_robots(0);
      move_miss(0);

      /* check for exploding missiles */
      for (i = 0; i < n; i++) {
        for (j = 0; j < MIS_ROBOT; j++) {
          if (missiles[i][j].stat == EXPLODING) {
            count_miss(i,j);
          }
        }
      }
    }

    /* is it time to record a frame? */
    if (--frame_timer <= 0) {
      frame_timer = UPDATE_CYCLES;
      record_frame(total_cycles);
    }
  }

  /* allow any flying missiles to explode */
  while (1) {
    k = 0;
    for (i = 0; i < n; i++) {
      for (j = 0; j < MIS_ROBOT; j++) {
	if (missiles[i][j].stat == FLYING) {
	  k = 1;
	}
      }
    }
    if (k) {
      move_robots(0);
      move_miss(0);
    }
    else
      break;
  }

  /* record final frame */
  record_frame(total_cycles);
}


/* end of main.c */
