import { useState } from "react"
import VideoConferencingTool from "./components/VideoConferencingTool"

function App() {
  const [toolAction, setToolAction] = useState("");
  const [roomId, setRoomId] = useState("");

  return (
    <main className="w-screen h-screen px-10 pt-9">
      <section className="w-full flex items-center justify-center font-semibold text-white gap-3">
        <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-[100px]
        border border-black outline-none h-8 text-black p-2"/>
        <button onClick={() => setToolAction("receive_call")} disabled={toolAction !== ""} className=" bg-blue-900 hover:bg-blue-950 transition-colors duration-300 p-3 rounded-lg ">Join Call</button>
        <button onClick={() => setToolAction("create_call")} disabled={toolAction !== ""} className="bg-green-600 hover:bg-green-700 transition-colors duration-300 p-3 rounded-lg ">Start Call</button>
      </section>
      { toolAction === "create_call" && <VideoConferencingTool  toolAction={toolAction}/>}
      { toolAction === "receive_call" && <VideoConferencingTool  toolAction={toolAction} roomId={roomId}/>}
      
    </main>
  )
}

export default App