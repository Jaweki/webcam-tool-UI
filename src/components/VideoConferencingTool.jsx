import { useEffect, useState } from "react"
import { FFmpeg } from '@ffmpeg/ffmpeg'
import io from 'socket.io-client';

function VideoConferencingTool() {
    const [socket, setSocket] = useState(null);
    const [webCapturing, setWebCapturing] = useState(false);
    const [streamObj, setStreamObj] = useState(null);

    const ffmpeg = new FFmpeg({ log: true });

    useEffect(() => {
        const socket = io('http://172.28.128.1:4000', {
            ackTimeout: 10000,
            retries: 3,
        });

        socket.connect();

        setSocket(socket);
        
        if (socket.connected) {
            getVideoFeed();
        }
    }, []);

    async function getCameraFeed() {
        const videoElement = document.getElementById("videoElement");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStreamObj(stream);
            videoElement.srcObject = stream;

            await ffmpeg.load();

            const transcoder = ffmpeg.createTranscoder();
            transcoder.input({ type: 'video', stream: stream})
            transcoder.output({ type: 'mpegts'}); // mpegts is suitable for streaming over networks

            transcoder.on('data', (data) => {
                socket.emit('video_data', data);
            });

            transcoder.run();

        } catch (error) {
            console.log(error);
            alert("Failed to get camera feed");
        }
    }

    async function stopCameraFeed() {
        try {
            await streamObj.getVideoTracks().forEach(track => track.stop());

            const videoElement = document.getElementById("videoElement");
            videoElement.srcObject = null;

            // alert("Camera feed switched off successfully.");
        } catch (error) {
            console.log(error);
            alert("Failed to gracefully stop the camera feed");
        }
    }

    const getVideoFeed = () => {
        const webConference = document.getElementById("conferenceVideo");
        try {
            socket.on('broadcast_video', (videoChunk) => {
                webConference.srcObject = videoChunk;
            })
        } catch (error) {
            console.log(error);
            alert("Failed to get video feed");
        }
    }

    const handleToggleWebcamMode = async () => {
        setWebCapturing(!webCapturing);

        if (!webCapturing) {
            await getCameraFeed();
        } else {
            await stopCameraFeed();
        }
    }

  return (
    <div className="w-full h-full flex items-center justify-center">

        <section className="w-[70%] h-[70%] flex flex-col rounded-b-3xl border-2 border-gray-500">
            <div className="w-full h-[80%] bg-blue-800 flex">
                <video id="videoElement" width={300} height={300} autoPlay className="w-[50%] h-full"></video>
                <video id="conferenceVideo" width={300} height={300} autoPlay className="w-[50%] h-full"></video>
            </div>
            <div className="flex justify-between items-center p-2 h-full">
                <p className=" text-orange-500 text-2xl w-[50%]">{!webCapturing && "Click Start Stream to activate the web cam and stream video on the blue screen"}</p>
                <button onClick={handleToggleWebcamMode} className=" bg-blue-500 text-white rounded-lg p-3">{webCapturing ? ( <span className=" text-red-600 font-bold">Stop camera feed</span>) : "Start camera Feed"}</button>
            </div>
        </section>
    </div>
  )
}

export default VideoConferencingTool