import socket
import sys
import time
from lightning_whisper_mlx import LightningWhisperMLX

def setup_server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('localhost', 51318))  # Adjust the IP and port as necessary
    s.listen()
    return s

def main():
    # Load the model
    model = LightningWhisperMLX(model="distil-small.en", batch_size=12, quant=None)
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
            result = model.transcribe(audio_path=data)
            end_time = time.time()
            print(f"Time taken: {end_time - start_time} seconds")
            conn.sendall(result['text'].encode('utf-8'))
        conn.close()

if __name__ == "__main__":
    main()