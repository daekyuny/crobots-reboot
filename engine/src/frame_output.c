
/*****************************************************************************/
/*  CROBOTS Reboot - Frame Recording                                         */
/*****************************************************************************/

#include "crobots.h"

/* missile array declared in crobots.h as missiles[MAXROBOTS][MIS_ROBOT] */

static Frame frame_buffer[MAX_FRAMES];
static int frame_count = 0;

void record_frame(long cycle) {
    int i, j, idx;

    if (frame_count >= MAX_FRAMES) return;

    Frame *f = &frame_buffer[frame_count++];
    f->cycle = cycle;

    /* Initialize all robot frames to zero/dead */
    for (i = 0; i < 4; i++) {
        f->robots[i].x = 0;
        f->robots[i].y = 0;
        f->robots[i].heading = 0;
        f->robots[i].speed = 0;
        f->robots[i].damage = 0;
        f->robots[i].scan_heading = 0;
        f->robots[i].status = DEAD;
    }

    /* Initialize all missile frames */
    for (i = 0; i < 8; i++) {
        f->missiles[i].x = 0;
        f->missiles[i].y = 0;
        f->missiles[i].heading = 0;
        f->missiles[i].status = AVAIL;
        f->missiles[i].owner = 0;
    }

    /* Record active robot state */
    for (i = 0; i < num_robots; i++) {
        f->robots[i].x       = robots[i].x / CLICK;   /* convert clicks to meters */
        f->robots[i].y       = robots[i].y / CLICK;
        f->robots[i].heading = robots[i].heading;
        f->robots[i].speed   = robots[i].speed;
        f->robots[i].damage  = robots[i].damage;
        f->robots[i].scan_heading = robots[i].scan;
        f->robots[i].status  = robots[i].status;
    }

    /* Record missile state: 2 missiles per robot */
    for (i = 0; i < num_robots; i++) {
        for (j = 0; j < MIS_ROBOT; j++) {
            idx = i * 2 + j;
            f->missiles[idx].x       = missiles[i][j].cur_x / CLICK;
            f->missiles[idx].y       = missiles[i][j].cur_y / CLICK;
            f->missiles[idx].heading = missiles[i][j].head;
            f->missiles[idx].status  = missiles[i][j].stat;
            f->missiles[idx].owner   = i;
        }
    }
}

int get_frame_count_internal(void) {
    return frame_count;
}

Frame* get_frame_buffer_internal(void) {
    return frame_buffer;
}

void reset_frames(void) {
    frame_count = 0;
}
