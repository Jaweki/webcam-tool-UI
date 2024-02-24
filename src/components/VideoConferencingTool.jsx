import { useEffect, useState } from "react"
import { FFmpeg } from '@ffmpeg/ffmpeg'
import io from 'socket.io-client';

function VideoConferencingTool() {
    const [socket, setSocket] = useState(null);
    const [webCapturing, setWebCapturing] = useState(false);
    const [streamObj, setStreamObj] = useState(null);

    const ffmpegClient = new FFmpeg({ log: true }); // transcoding before sending to backend
    const ffmpegServer = new FFmpeg({ log: true }); // transcoding when recived from backend
    
    useEffect(() => {
        try {
            const socket = io('ws://localhost:5001', {
            ackTimeout: 10000,
            retries: 3,
        });

        socket.connect();

        socket.on('connect', () => {
            console.log('Socket connected');
        });
    
        socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
    
        setSocket(socket);
    
        return () => {
            // Clean up socket connection on component unmount
            socket.disconnect();
        };

        } catch (error) {
            console.log('failed to make socket connection: ', error);
        }
        
    }, []);

    async function getCameraFeed() {
        const videoElement = document.getElementById("videoElement");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStreamObj(stream);
            videoElement.srcObject = stream;

            // without transcoding
            await ffmpegClient.load();
           ffmpegClient.writeFile()

            const transcoder = ffmpegClient.createTranscoder();
            transcoder.input({ type: 'video', stream: stream})
            transcoder.output({ type: "mpegts" })
            transcoder.run()

            transcoder.on('data', (data) => {
                socket.emit('video_data', data);
            })

            getVideoFeed();
        } catch (error) {
            console.log(error);
            alert("Failed to get camera feed");
        }
    }

    async function stopCameraFeed() {
        try {
            await streamObj.getVideoTracks().forEach(track => track.stop()); // stops the camera from recoding video

            const videoElement = document.getElementById("videoElement");
            videoElement.srcObject = null;

            alert("Camera feed switched off successfully.");

        } catch (error) {
            console.log(error);
            alert("Failed to gracefully stop the camera feed");
        }
    }

    const getVideoFeed = async() => {
        const webConference = document.getElementById("conferenceVideo");
    
        await ffmpegServer.load()

        const transcoder = ffmpegServer.createTranscoder()

        // at the moment no transcoding
        socket.on("broadcast_data", (videoChunk) => {
            transcoder.input({ type: "mpegts" })
            transcoder.output({ type: 'video', stream: videoChunk})
            transcoder.run()
        });

        transcoder.on('data', (data) => {
            webConference.playsInline = true;
            webConference.srcObject = data;
        })
    };

    // button Onclick handler
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
                {/* Current user camera feed */}
                <video id="videoElement" width={300} height={300} autoPlay className="w-[50%] h-full"></video>

                {/* Video feed from backend */}
                <video id="conferenceVideo" width={300} height={300} autoPlay className="w-[50%] h-full"></video>
            </div>

            <div className="flex justify-between items-center p-2 h-full">
                <p className=" text-orange-500 text-2xl w-[50%]">{!webCapturing && "Click Start Stream to activate the webcam and stream video on the blue screen"}</p>

                <button onClick={handleToggleWebcamMode} className=" bg-blue-500 text-white rounded-lg p-3">{webCapturing ? ( <span className=" text-red-600 font-bold">Stop camera feed</span>) : "Start camera Feed"}</button>
            </div>
        </section>
    </div>
  )
}

export default VideoConferencingTool