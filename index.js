import OpenAI from 'openai';
import say from 'say';
import nlp from 'compromise';
import net from 'net';
import record from 'node-record-lpcm16';
import fs from 'fs';
const openai = new OpenAI({
    apiKey: 'lm-studio',
    baseURL: 'http://localhost:1234/v1'
});

const file = 'temp_audio.wav'; // Temporary file to save audio
const client = new net.Socket();

client.connect(51318, '127.0.0.1', () => {
    console.log('Connected to Python server!');
});

process.on('SIGINT', cleanUp);
process.on('SIGTERM', cleanUp);
process.on('exit', cleanUp);

function cleanUp() {
    console.log('Cleaning up before exit...');
    say.stop();
    speakingQueue.sentences = [];
    client.end(() => {
        console.log('Connection closed.');
    });
}

const messages = [
    { role: 'system', content: 'You are a helpful assistant currently engaged in a conversation with a user through a text-to-speech interface. Keep your responses conversational, avoid using numbered lists or parentheses, and respond casually. Your responses are short and to the point, and generally match the length of the user\'s message unless detail is specifically asked for.' },
]
const handlers = {
    onData: () => {}
}
client.on('data', function(data) {
    handlers.onData(data);
});

function getMessage() {
    return new Promise((resolve, reject) => {
        const recorder = record.record({
            sampleRateHertz: 16000,
            thresholdStart: 1.75,
            thresholdEnd: 1.5,
            verbose: false,
            endOnSilence: true,
            recordProgram: 'sox', // Ensure you have sox installed
            format: 'wav',
            silence: '1.0'
        });

        recorder.stream().pipe(fs.createWriteStream(file));

        recorder.stream().on('end', () => {
            recorder.stop();
            client.write(file);
        });
        handlers.onData = (data) => {
            resolve(data.toString().trim());
        }
    });
}
const speakingQueue = {
    sentences: [],
    speaking: false,
    push(sentence) {
        this.sentences.push(sentence);
    },
    read() {
        if (this.sentences.length > 0) {
            const sentence = this.sentences.shift();
            this.speaking = true;
            say.speak(sentence, 'Daniel', 1, () => {
                if (this.sentences.length === 0) {
                    this.speaking = false;
                }
                this.read();
            });
        } else {

            setTimeout(this.read.bind(this), 1);
        }
    },
    empty() {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (!this.speaking && this.sentences.length === 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1);
        });

    }
}
speakingQueue.read()

async function getAndSpeakResponse() {
    const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        stream: true,
    });
    let response = '';
    let sentenceBuffer = '';
    let chunkIndex = 0;
    for await (const chunk of stream) {
        if (chunk.choices[0].finish_reason === 'stop') {
            break;
        }
        if (chunkIndex === 0) {
            chunk.choices[0].delta.content = chunk.choices[0].delta.content.slice(chunk.choices[0].delta.content.lastIndexOf('>') + 2)
        }
        chunkIndex++;
        response += chunk.choices[0].delta.content;
        sentenceBuffer += chunk.choices[0].delta.content;
        let nlpedSentenceBuffer = nlp(sentenceBuffer);
        let sentenceBufferClauses = nlpedSentenceBuffer.clauses().data().map(x => x.text);
        if (sentenceBufferClauses.length > 1) {
            speakingQueue.push(sentenceBufferClauses[0]);
            sentenceBuffer = sentenceBufferClauses.slice(1).join(' ');
        }
    }
    speakingQueue.push(sentenceBuffer);
    await speakingQueue.empty();
    return response;
}


async function main() {
    while (true) {
        console.log('Waiting for user message...');
        const message = await getMessage();
        messages.push({ role: 'user', content: message });
        console.log('User message:', message);
        console.log('Getting and speaking response...');
        const response = await getAndSpeakResponse();
        messages.push({ role: 'assistant', content: response });
        console.log('Assistant response:', response);
    }
}
main();