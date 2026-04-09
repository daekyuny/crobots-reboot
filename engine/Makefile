CC = gcc
EMCC = emcc
# Suppress legacy C warnings from the original 1985 source code
LEGACY_FLAGS = -Wno-implicit-int -Wno-implicit-function-declaration -Wno-deprecated-non-prototype -Wno-return-type -Wno-format
SRCS = src/main.c src/cpu.c src/intrins.c src/motion.c \
       src/compiler.c src/grammar.c src/lexanal.c \
       src/frame_output.c src/wasm_api.c

EXPORTED_FUNCTIONS = '["_compile_robot","_get_compile_error","_reset_battle","_run_battle","_get_frame_count","_get_frame_buffer","_get_frame_size","_malloc","_free"]'
EXPORTED_RUNTIME = '["ccall","cwrap","UTF8ToString","stringToUTF8","intArrayFromString","HEAPU8","HEAP32"]'

.PHONY: native wasm grammar clean

grammar:
	bison -d -o src/grammar.c src/grammar.y
	flex -o src/lexanal.c src/lexanal.l

native:
	mkdir -p build
	$(CC) -O2 $(LEGACY_FLAGS) -o build/crobots_native $(SRCS) -lm

wasm:
	mkdir -p build
	$(EMCC) $(LEGACY_FLAGS) $(SRCS) \
	  -o build/engine.js \
	  -s WASM=1 \
	  -s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCTIONS) \
	  -s EXPORTED_RUNTIME_METHODS=$(EXPORTED_RUNTIME) \
	  -s ALLOW_MEMORY_GROWTH=1 \
	  -s INITIAL_MEMORY=67108864 \
	  -s MODULARIZE=1 \
	  -s EXPORT_NAME="CrobotsEngine" \
	  -O2 \
	  -lm

clean:
	rm -rf build
