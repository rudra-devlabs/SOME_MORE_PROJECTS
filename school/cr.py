import time
import sys

def braille_spinner(duration_seconds: int) -> None:
    # Smooth rotating dot characters
    chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    end_time = time.time() + duration_seconds
    
    while time.time() < end_time:
        for char in chars:
            sys.stdout.write(f"\r{char} Processing...")
            sys.stdout.flush()
            time.sleep(0.05)
            
    sys.stdout.write("\rComplete!             ")

braille_spinner(2)
