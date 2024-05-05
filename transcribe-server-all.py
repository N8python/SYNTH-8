import socket
import sys
import time
from faster_whisper import WhisperModel

def setup_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 51318))  # Adjust the IP and port as necessary
    s.listen()
    return s

def main():
    # Load the model
    model = WhisperModel("small", device="cpu", compute_type="int8")
    print("Model loaded successfully.")
    
    server = setup_server()
    print("Server started, waiting for connections...")

    while True:
        conn, addr = server.accept()
        print(f"Connected by {addr}")

        while True:
            data = conn.recv(1024 * 16).decode('utf-8').strip()
            if not data:
                break
            print(f"Received audio file path: {data}")
            start_time = time.time()
            segments, info = model.transcribe(data, beam_size=5)
            result = "".join([s.text for s in list(segments)])
            end_time = time.time()
            print(f"Time taken: {end_time - start_time} seconds")
            conn.sendall(result.encode('utf-8'))
        conn.close()

if __name__ == "__main__":
    main()