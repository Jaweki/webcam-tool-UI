import { useEffect, useRef, useState } from "react";
import io from 'socket.io-client';

// eslint-disable-next-line react/prop-types
function VideoConferencingTool({ toolAction, roomId }) {
   const [videoElements, setVideoElements] = useState([{}]);
   const videoelementsRefs = useRef([]);
   const videoSectionRef = useRef(null);
   const rtcConfiguration = {
    iceServers: [
        { 
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun.ekiga.net',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ]    
        }
    ]
   }

//    Creating RTCPeerConnections and attaching the media streams to video elements

    useEffect(() => {
        const socket = io('wss://webcam-tool-backend-96262bb3e455.herokuapp.com', {
            ackTimeout: 10000,
            retries: 3,
            autoConnect: false,
        })

        socket.connect()

        socket.on("connect", async () => {
            console.log("UI has connected to web_socket successfully")
            
            const uuid = Math.floor(Math.random() * 100000)

            if (toolAction === "create_call") {
                console.log(" a call...")
                socket.emit("set_caller_id", uuid)
                
                await createPeerConncetion(socket);
            } else if (toolAction === "receive_call") {
                console.log("receiveing a call...")
                await joinPeerConnection(socket)
            } else {
                console.log("Tool action not defined wheather to call or recive a call")
            }
        })

        socket.on("disconnect", () => {
            console.log("UI has disconnected from web_socket")
        })
    
        // when this component unmounts
        return () => {
            // disconnect from socket
            socket.disconnect()
        }
    }, [])

    const createPeerConncetion = async (signalingSocket) => {
        try {
            
            // initialize a peer connection object
            const peerConncetion = new RTCPeerConnection(rtcConfiguration)

            // This function is when the User of this ui wants to start a peer connection offer
            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true})
            const remoteStream = new MediaStream()

            // attach the media stream to the first video element in the DOM
            const callerVideoElement = document.getElementById("video_element_0")
            callerVideoElement.srcObject = localStream

             // attach the local mediastream and hence the track of this session creator to the peer connection object
             localStream.getTracks().forEach(track => {
                track.enabled = true
                peerConncetion.addTrack(track, localStream)
            })

            // peer connection instance add event handler for when remote stream is available
            peerConncetion.ontrack = (event) => {
                console.log("Track event | Caller listening: ", event)
                const index = videoElements.length - 1
                if (index > 0) {
                    // apply remote media stream to the newlly created video element
                    const calleeVideoElement = document.getElementById(`video_element_${videoElements.length - 1}`)
                    calleeVideoElement.srcObject = remoteStream
                    event.streams[0].getTracks().forEach(track => {
                        remoteStream.addTrack(track)
                    })
                }
            }

            peerConncetion.onicecandidateerror = (event) => {
                console.log("Error finding icecandidate: ", event)
            }

            // send discovered icecandiates to signalling server
            peerConncetion.onicecandidate = (event) => {
                if (event.candidate) {
                    const iceCandidateObj = event.candidate;

                    console.log("New caller Ice candidate found: ", iceCandidateObj)

                    signalingSocket.emit("set_caller_icecandidate", iceCandidateObj)
                } else {
                    console.log("No more Ice candidates")
                }
            }

            // Define media constraints
            const mediaConstraints = {};

            // Create an SDP offer
            peerConncetion.createOffer(mediaConstraints).then( async (sdpOffer) => {
                
                // store the created SDP offer as local session description
                await peerConncetion.setLocalDescription(sdpOffer);
                
                if (signalingSocket.connected) {
                    // send caller SDP offer to signalling server
                    signalingSocket.emit("caller_sdp_offer", sdpOffer);
                } else {
                    console.log("socket not connected trying to reconnect")
                    signalingSocket.connect()
                    
                    signalingSocket.on("connect", () => {
                        console.log("socket reconnected; trying to send new sdp Offer")
                        signalingSocket.emit("caller_sdp_offer", sdpOffer)
                    })

                }
                console.log("new sdp offer: ", sdpOffer)
            })

            // listen for incomming answer and set the answer as a remote description
            signalingSocket.on("caller_awaited_sdp_answer", (sdp_answer) => {

                if (peerConncetion.signalingState === 'have-remote-offer' || peerConncetion.signalingState === 'stable') {
                    console.log("received callee sdp answer: ", sdp_answer)
                    peerConncetion.setRemoteDescription(sdp_answer).then(() => {
                        // add a new video element waiting to be updated with the remote stream
                        setVideoElements([...videoElements, {}]);  
                    })
                }
            })


        } catch (error) {
            console.log("Error while creating Caller peerConnection: ", error)
        }
    }

    const joinPeerConnection = async (signalingSocket) => {
        // This function is when the user of this ui wants to join a peer connection offer

        try {
            
            // instantiate an RTCPeerConncetion object passing ice server urls as rtc configuration
            const peerConncetion =  new RTCPeerConnection(rtcConfiguration)

            const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio:true })
            const remoteStream = new MediaStream()

            // attach the media stream to the first video element in the DOM
            const calleeVideoElement = document.getElementById("video_element_0")
            calleeVideoElement.srcObject = localStream

            localStream.getTracks().forEach(track => {
                track.enabled = true
                peerConncetion.addTrack(track, localStream)
            })

            // listen for when there is media stream available from the peer connection
            peerConncetion.ontrack = (event) => {
                // apply remote media stream to the newly created video element
                const index = videoElements.length - 1;
                if (index > 0) {
                    const callerVideoElement = document.getElementById(`video_element_${index}`);
                
                    callerVideoElement.srcObject = remoteStream
                
                    event.streams[0].getTracks().forEach(track => {
                        remoteStream.addTrack(track)
                    })
                }

            }

            // send discovered icecandiates to signalling server
            peerConncetion.onicecandidate = (event) => {
                if (event.candidate) {
                    const iceCandidateObj = event.candidate;

                    console.log("New callee Ice candidate found: ", iceCandidateObj)

                    signalingSocket.emit("set_callee_icecandidate", iceCandidateObj)
                } else {
                    console.log("No more Ice candidates")
                }
            }
            
            signalingSocket.emit("request_caller_sdp_offer", roomId)
            
            signalingSocket.on("available_caller_sdp_offer", (sdp_offer) => {
                
                console.log("available caller sdp offer: ", sdp_offer)
                // Set the callers sdp offer as this callees' remote description
                peerConncetion.setRemoteDescription(sdp_offer).then(() => {
                    // create an answer to generate an sdp answer
                    const mediaConstraints = {}
                    peerConncetion.createAnswer(mediaConstraints).then( async (sdpAnswer) => {

                        // set the answer as this callees' local description
                        await peerConncetion.setLocalDescription(sdpAnswer);

                        // send the answer to the signalling server for the caller to associate it as a remote description
                        signalingSocket.emit("callee_sdp_answer", sdpAnswer)
                    }).then(() => {
                        // add a new video element waiting to be updated with media stream
                        setVideoElements([...videoElements, {}])
                    })
                })

            })

            signalingSocket.emit("request_caller_ice_candidates", roomId)

            signalingSocket.on("caller_icecandidates", (RTCIceCandidate_) => {
                // associate the callers ice candidates with this callee ice candidates
                peerConncetion.addIceCandidate(RTCIceCandidate_)
                console.log("received caller related ice candidate: ", RTCIceCandidate_)
            })


            
            console.log("call received...")
        } catch (error) {
            console.log("Failed to join a peer connection: ", error)
        }

    }

//    setting up the UI responsible for displaying the video streams
   useEffect(() => {
    if (videoElements.length > 4) {
        const gridColumnscount = Math.ceil(Math.sqrt(videoElements.length));
        const gridTemplateColumns = `repeat(${gridColumnscount}, 1fr)`
        videoSectionRef.current.style.gridTemplateColumns = gridTemplateColumns;
    }
   }, [videoElements])

   const handleRemoveVideo = () => {
    if (videoElements.length > 0) {
        videoelementsRefs.current.pop();
        setVideoElements(videoElements.slice(0, videoElements.length - 1))
    }
   }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <section 
            ref={videoSectionRef} 
            className={`w-[70%] h-[70%] gap-2 rounded-b-3xl border-2 border-gray-500 bg-black ${videoElements.length <= 4 ? "items-center justify-center flex flex-wrap" : "grid p-3" }`}
            >
            {videoElements.map((_, index) => (
                <div 
                key={`video-${index}`}
                className={` relative ${videoElements.length <= 4 ? "w-[40%] h-[40%]" : "w-full h-full"}`}
                >
                    <video
                        id={`video_element_${index}`}
                        className={`bg-green-500 object-cover w-full h-full`}
                        autoPlay
                    />
                    <div
                     className=" absolute inset-0 w-full h-full bg-black bg-opacity-40 flex items-end justify-center opacity-0 hover:opacity-100 transition-all duration-500 text-white" >
                        video controls
                    </div>
                </div>
            ))}
        </section>
        <section  className="flex w-full items-center justify-center">
            <button onClick={handleRemoveVideo} className="bg-white text-red-500 hover:text-red-600 font-semibold border hover:border-red-600 border-red-500 p-3 rounded-lg transition-colors duration-300" disabled={!(videoElements.length > 1)}>Hung Up this Call</button>
        </section>
    </div>
  )
}

export default VideoConferencingTool