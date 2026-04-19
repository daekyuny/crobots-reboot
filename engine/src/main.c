

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
  robots[i].scan_res = 0;
  robots[i].scan_dist = 0;
  robots[i].reload = 0;
  robots[i].stall_cycles = 0;
  robots[i].team = 0;
  robots[i].last_scan_is_friend = 0;
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


/* battle_result - outcome of the most recent battle */
int battle_end_reason = END_NORMAL;
int battle_winner     = -1;   /* robot index, or -1 for draw */

/* stall configuration — runtime-settable; default off (battles run to CYCLE_LIMIT) */
int stall_enabled     = 0;    /* 0 = disabled, 1 = enabled */
int stall_window_cyc  = 10000; /* motion cycles with no damage before declaring stall */


/* compute_battle_result - determine end_reason and winner after battle loop */

static void compute_battle_result(int n, int stall_detected, long total_cycles)
{
  int i;
  int survivors = 0;
  int min_damage = 101;
  int winner_idx = -1;
  int tie = 0;

  battle_is_team = (team_mode > 0) ? 1 : 0;

  if (team_mode > 0) {
    /* Team mode: winner is the surviving team id */
    int team0_alive = 0, team1_alive = 0;
    int team0_damage = 0, team1_damage = 0;
    for (i = 0; i < n; i++) {
      if (robots[i].status == ACTIVE) {
        if (robots[i].team == 0) { team0_alive++; team0_damage += robots[i].damage; }
        else { team1_alive++; team1_damage += robots[i].damage; }
      }
    }

    if (team0_alive > 0 && team1_alive == 0) {
      battle_end_reason = END_NORMAL;
      battle_winner = 0;  /* team 0 wins */
    } else if (team1_alive > 0 && team0_alive == 0) {
      battle_end_reason = END_NORMAL;
      battle_winner = 1;  /* team 1 wins */
    } else if (team0_alive == 0 && team1_alive == 0) {
      battle_end_reason = END_NORMAL;
      battle_winner = -1;  /* mutual destruction */
    } else {
      /* both teams alive: stall or cycle limit, compare total damage */
      battle_end_reason = stall_detected ? END_STALL : END_CYCLE_LIMIT;
      if (team0_damage < team1_damage)
        battle_winner = 0;
      else if (team1_damage < team0_damage)
        battle_winner = 1;
      else
        battle_winner = -1;  /* tied damage = draw */
    }
    return;
  }

  /* FFA mode: original logic */
  for (i = 0; i < n; i++) {
    if (robots[i].status == ACTIVE) {
      survivors++;
      if (robots[i].damage < min_damage) {
        min_damage = robots[i].damage;
        winner_idx = i;
        tie = 0;
      } else if (robots[i].damage == min_damage) {
        tie = 1;
      }
    }
  }

  if (survivors == 1) {
    battle_end_reason = END_NORMAL;
    battle_winner = winner_idx;
  } else if (survivors == 0) {
    /* mutual destruction */
    battle_end_reason = END_NORMAL;
    battle_winner = -1;
  } else {
    /* multiple survivors: stall or cycle limit */
    battle_end_reason = stall_detected ? END_STALL : END_CYCLE_LIMIT;
    battle_winner = tie ? -1 : winner_idx;
  }
}


/* run_battle_wasm - run a single battle, called from wasm_api */

void run_battle_wasm(int n)
{
  int robotsleft;
  int movement;
  int frame_timer;
  int i, j, k;
  long total_cycles = 0L;
  int stall_counter = 0;
  int stall_detected = 0;
  int last_damage_total = 0;

  num_robots = n;
  r_debug = 0;

  /* reset and activate all robots (init_robot clears game state without
     touching compiled code; robot_go resets the instruction pointer) */
  for (i = 0; i < n; i++) {
    int saved_team = robots[i].team;
    init_robot(i);
    robots[i].team = saved_team;
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
  while (robotsleft > 1 && total_cycles < CYCLE_LIMIT && !stall_detected) {
    for (i = 0; i < n; i++) {
      if (robots[i].status == ACTIVE) {
        if (robots[i].stall_cycles > 0) {
            robots[i].stall_cycles--;
        } else {
            cur_robot = &robots[i];
	    cycle();
        }
      }
    }

    /* count survivors: team-aware or FFA */
    if (team_mode > 0) {
      int team0_alive = 0, team1_alive = 0;
      for (i = 0; i < n; i++) {
        if (robots[i].status == ACTIVE) {
          if (robots[i].team == 0) team0_alive++;
          else team1_alive++;
        }
      }
      robotsleft = (team0_alive > 0 && team1_alive > 0) ? 2 : (team0_alive + team1_alive > 0 ? 1 : 0);
    } else {
      robotsleft = 0;
      for (i = 0; i < n; i++) {
        if (robots[i].status == ACTIVE) robotsleft++;
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

      /* stall detection: reset counter if any damage occurred this motion cycle.
         Only active when stall_enabled is set; threshold is stall_window_cyc. */
      if (stall_enabled) {
        int damage_total = 0;
        for (i = 0; i < n; i++)
          damage_total += robots[i].damage;
        if (damage_total > last_damage_total) {
          last_damage_total = damage_total;
          stall_counter = 0;
        } else {
          if (++stall_counter >= stall_window_cyc) {
            stall_detected = 1;
            break;
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

  /* allow any flying missiles to explode (skip on stall — stop immediately) */
  if (!stall_detected) {
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
  }

  /* record final frame */
  record_frame(total_cycles);

  compute_battle_result(n, stall_detected, total_cycles);
}


/* end of main.c */
