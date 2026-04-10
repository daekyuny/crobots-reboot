
/*****************************************************************************/
/*  CROBOTS Reboot - WebAssembly API                                         */
/*****************************************************************************/

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "crobots.h"
#include "compiler.h"

/* External references */
extern FILE *f_in, *f_out;
extern void init_robot(int i);
extern void free_robot(int i);
extern void run_battle_wasm(int n);
extern int get_frame_count_internal(void);
extern Frame* get_frame_buffer_internal(void);
extern void reset_frames(void);
extern int battle_end_reason;
extern int battle_winner;

/* Lexer/parser externals */
extern int yyparse(void);
extern char *yysptr, yysbuf[];
extern int yyprevious;
extern int yylineno;

/* Error buffer for compile errors */
static char compile_error_buf[1024];

/* Extract lines containing "Error" or "Warning" from raw compiler output */
static void extract_errors(const char *raw, char *out, size_t outsize) {
    const char *p = raw;
    size_t used = 0;
    char line[512];

    while (*p && used < outsize - 2) {
        const char *end = strchr(p, '\n');
        if (!end) end = p + strlen(p);

        size_t len = (size_t)(end - p);
        if (len > 0 && len < sizeof(line) - 1) {
            memcpy(line, p, len);
            line[len] = '\0';
            if (strstr(line, "Error") || strstr(line, "Warning")) {
                size_t space = outsize - 1 - used;
                size_t copy = (len < space) ? len : space;
                memcpy(out + used, line, copy);
                used += copy;
                if (used < outsize - 1) out[used++] = '\n';
            }
        }
        p = (*end == '\n') ? end + 1 : end;
        if (*p == '\0') break;
    }
    out[used] = '\0';

    /* Trim trailing newline */
    if (used > 0 && out[used - 1] == '\n') out[--used] = '\0';

    if (used == 0)
        strncpy(out, "Compilation failed (unknown error)", outsize - 1);
}


/* reset_lexer - reset the lexer global state for a fresh compilation */
static void reset_lexer(void) {
    yysptr = yysbuf;
    yylineno = 1;  /* lexer increments on newline, so line 1 starts at 1 */
}


EMSCRIPTEN_KEEPALIVE
int compile_robot(const char *source, int slot) {
    int result;
    char *captured = NULL;
    size_t captured_size = 0;

    if (slot < 0 || slot >= MAXROBOTS) {
        snprintf(compile_error_buf, sizeof(compile_error_buf),
                 "Invalid slot %d (must be 0-%d)", slot, MAXROBOTS-1);
        return -1;
    }

    compile_error_buf[0] = '\0';
    reset_lexer();

    init_robot(slot);
    robots[slot].name[0] = '\0';
    snprintf(robots[slot].name, sizeof(robots[slot].name), "robot%d", slot);

    f_in = fmemopen((void*)source, strlen(source), "r");
    if (f_in == NULL) {
        snprintf(compile_error_buf, sizeof(compile_error_buf),
                 "Failed to open source for compilation");
        return -1;
    }

    /* Capture all compiler output (errors, warnings, stats) into memory */
    f_out = open_memstream(&captured, &captured_size);
    if (f_out == NULL) {
        /* Fallback: discard output */
        f_out = fopen("/dev/null", "w");
    }

    r_flag = 0;
    r_debug = 0;
    cur_robot = &robots[slot];

    init_comp();
    yyparse();
    result = reset_comp();

    fclose(f_in);
    fclose(f_out);
    f_in = NULL;
    f_out = NULL;

    if (r_flag || !result) {
        /* Pull error/warning lines out of captured output */
        extract_errors(captured ? captured : "", compile_error_buf,
                       sizeof(compile_error_buf));
        if (captured) free(captured);
        free_robot(slot);
        return -1;
    }

    if (captured) free(captured);
    return 0;
}


EMSCRIPTEN_KEEPALIVE
const char* get_compile_error(void) {
    return compile_error_buf;
}


EMSCRIPTEN_KEEPALIVE
void reset_battle(void) {
    int i;
    for (i = 0; i < MAXROBOTS; i++) {
        free_robot(i);
        init_robot(i);
    }
    reset_frames();
}


EMSCRIPTEN_KEEPALIVE
void run_battle(int n) {
    reset_frames();
    run_battle_wasm(n);
}


EMSCRIPTEN_KEEPALIVE
int get_frame_count(void) {
    return get_frame_count_internal();
}


EMSCRIPTEN_KEEPALIVE
const Frame* get_frame_buffer(void) {
    return get_frame_buffer_internal();
}


EMSCRIPTEN_KEEPALIVE
int get_frame_size(void) {
    return (int)sizeof(Frame);
}


EMSCRIPTEN_KEEPALIVE
int get_end_reason(void) {
    return battle_end_reason;
}


EMSCRIPTEN_KEEPALIVE
int get_winner(void) {
    return battle_winner;
}
