import React, {useEffect, useMemo, useRef, useState} from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "react-query"
import useWebSocket, {ReadyState} from "react-use-websocket"
import useWebShare from "react-use-web-share"


import {ReactComponent as BACK} from "../icons/back.svg"
import {ReactComponent as SEND} from "../icons/send.svg"
import {ReactComponent as SHARE} from "../icons/share.svg"
import {ReactComponent as CLOSE} from "../icons/close.svg"
import {ReactComponent as INFO} from "../icons/info.svg"

import ChatCard from "../components/message-card"
import AutoHeightTextarea from "../components/auto-resize-textarea"

import {  MafiaInfoModal, ShareInviteModal, TimedMessageModal  } from "../modals/info-modal"
import { randInt } from "../utils/random-generator"

import { getMessages, getMafia, uploadChatMedia } from "../apis/loner-apis"
import { Error404 } from "../error-pages/errors"
import { LoadingWheel } from "../components/loading"
import { MAX_LENGTH } from "../constants/lengths"
import { MaifaFormModal } from "../modals/mafia-form-modal"
// import { useTitle } from "../utils/hooks"


const docElementStyle = document.documentElement.style


/**
 * Displays chat header
 * @param onMafiaUpdate: function - function to be executed when the mafia info is updated
 * @param props - contains name, icon, about, tag_line and rules: Array
 * 
 */
function ChatHeader({onMaifaUpdate, props}){

    const {name="", icon="", about="", tag_line="", rules=[]} = props
    
    const history = useNavigate()
    const webShare = useWebShare()

    const [timedMesage, setTimedMessage] = useState("")
    const [showInfoModal, setShowInfoModal] = useState(false)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showMafiaEditModal, setShowMafiaEditModal] = useState(false)

    useEffect(() => {

        if (sessionStorage.getItem("show-invite") === "true"){
            setShowInviteModal(true)
            sessionStorage.removeItem("show-invite")
        }

    }, [])

    const handleShare = () => {

        if (webShare.isSupported){
            webShare.share({
                title: `Hey there, here is your invitation to join the ${name}`,
                text: `Special invite for you to speak your mind out at ${name} mafia on loners maifa; completely anonymously, no email, no password, just anonymity.`,
                url: window.location
            })
        }
        else{
            // navigator.clipboard.writeText(process.env.REACT_APP_API_ENDPOINT)
            navigator.clipboard?.writeText(window.location)
            setTimedMessage("Link copied to clipboard")
        }

    }

    const handleEditSuccess = () => {

        if (onMaifaUpdate)
            onMaifaUpdate()

        setShowMafiaEditModal(false)
    }   

    return (
        <div className="chat-header">

            {
                timedMesage !== ""?
                <TimedMessageModal message={timedMesage} timeout={2000} onTimeOut={() => setTimedMessage("")}/>
                :
                null
            }
      
            {
                showInviteModal ? 
                    <ShareInviteModal 
                        message={"Grow your mafia. Quick invite other loners"}
                        url={window.location}
                        title={`Here's your invite to join ${name} mafia on loners mafia`}
                        text={`invite to join ${name} mafia on loners mafia, a truely anonymous platform to speak your mind out`}
                        onClose={() => setShowInviteModal(false)}/>
                    :
                    null
            }
            
            {showInfoModal ?
                <MafiaInfoModal onClose={() => setShowInfoModal(false)}
                                name={name}
                                icon={icon}
                                about={about}
                                tag_line={tag_line}
                                rules={rules}
                                editable={sessionStorage.getItem("is_mod")==="true"}
                                onEdit={() => {
                                    setShowInfoModal(false)
                                    setShowMafiaEditModal(true)
                                }}
                />
                
                :
                null
            }

            {
                showMafiaEditModal ? 

                <MaifaFormModal onClose={() => setShowMafiaEditModal(false)}
                                id={props.id}
                                name={name}
                                iconUrl={icon}
                                about={about}
                                tag_line={tag_line}
                                bgColor={props.color_theme}
                                bgImgUrl={props.background_image}
                                rules={rules.map(({ rule }) => rule)}
                                update={true}
                                onSuccess={handleEditSuccess}
                />
                :

                null
            }

            <div className="row center margin-10px">
                <BACK className="icon margin-10px" onClick={() => history("/loner")}/>
                <img src={icon} alt=" " className="mafia-icon"/>
                <div className="info column margin-10px">
                    <div className="mafia-name">
                        {name}
                    </div>

                    <div className="mafia-tag">
                        {tag_line}
                    </div>
                </div>
            </div>
            <SHARE className="margin-10px icon" onClick={handleShare}/>

            <INFO className="margin-10px icon" onClick={() =>setShowInfoModal(!showInfoModal)}/>


            {/* <div className="peckspace-promo margin-10px">
                visit <a href="https://peckspace.com/spaces" className="link">Peckspace</a>  Now!
            </div> */}

        </div>
    )

}

// random texts to be filled for first time users.
const randomTexts = [
    "I am a memer and will send memes to all the loners out there 🚀",
    "I am an artist and will show you my best works now!",
    "I am going to speak my mind out!",
    "I love you ❤️‍🔥",
    "I would like fried 🐔 please",
    "I prefer to show you the best of who I am ;)",
    "sending memes to all the loners out there ",
    "I love Mars 🌑",
    "I am going to the moon 🚀",
    "A fried chicken here pless....",
    "Hushhh! keep the noise down", 
    "Party at my house!!!",
    "Invade the Universe"
]

/**
 * Makes websocket connection and handles incoming and outgoing messages
 */
export default function Chat(){
    // TODO: reconnect websocket after login
    const {mafia} = useParams() 

    console.log("Maifa: ", mafia)

    // useTitle(mafia, [mafia])

    const mediaRef = useRef()
    const queryClient = useQueryClient()

    const [text, setText] = useState("")
    const [media, setMedia] = useState({
        fileObject: null,  // media object
        fileUrl: null, //media url
        fileType: '' // media type, image/video
    })

    const [socketUrl, setSocketUrl] = useState(`${process.env.REACT_APP_WEBSOCKET_ENDPOINT}/mafia/${mafia}/`)
    const [timedMesage, setTimedMessage] = useState("")
    const [messagable, setMessageble] = useState(true)
    const [show404Page, setShow404Page] = useState(false)
    const [queryEnabled, setQueryEnabled] = useState(false)

    const [mafiaDetails, setMafiaDetails] =useState({
                                            id: null,
                                            name: "",
                                            icon: "",
                                            rules: [],
                                            mods: [],
                                            is_mod: false,
                                            is_staff: false
                                            })

    const [messages, setMessages] = useState([])
    const [socketCloseReason, setSocketCloseReason] = useState("")


    const [scrollToEnd, setScrollToEnd] = useState(true)
    const scrollRef = useRef() // refernce to chat body
    const lastMessageRef = useRef() //reference to the last message div

    const {sendJsonMessage, lastJsonMessage, readyState, getWebSocket} = useWebSocket(socketUrl, {
                                                                onOpen: () => console.log('opend connection'),
                                                                onClose: (closeEvent) => {
                                                                    // console.log("Close Event: ", closeEvent)
                                                                    if (closeEvent.code === 3401){
                                                                        setTimedMessage("You cannot connect to this socket")
                                                                        sessionStorage.clear()
                                                                        setSocketCloseReason("You have been banned here. You will not receive realtime messages")
                                                                        setMessageble(false)
                                                                    }
                                                                    
                                                                    else if (closeEvent.code === 3404){
                                                                        setTimedMessage("You cannot connect to this socket")
                                                                        setSocketCloseReason("This mafia doesn't exist. But you can always create one :)")
                                                                        setMessageble(false)

                                                                    }
                                                                    
                                                                    else if (closeEvent.code !== 1000)
                                                                        setTimedMessage("Connection to server lost. Attempting to reconnect.")
                                                                
                                                                },
                                                                //Will attempt to reconnect on all close events, such as server shutting down
                                                                shouldReconnect: (closeEvent) => {
                                                                    // console.log("Close event: ", closeEvent.code)
                                                                    if (closeEvent.code !== 3401 && closeEvent.code !== 3404){
                                                                        return true
                                                                    }

                                                                    return false
                                                                },
                                                                onError: (error) => {
                                                                    setTimedMessage("something went wrong")
                                                                    // console.log("Error: ", error)
                                                                }
                                                            })
    const mafiaQuery = useQuery(["mafia", mafia], () => getMafia(mafia), {
        enabled: !mafia ? false : true,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 60 * 60 * 1000, // 60 minutes

        onSuccess: (data) => {
            // console.log("Data: ", data.data)
            setMafiaDetails(data.data)
            
        },

        onError: (err) => {
            if (err.response?.status === 404){
                setShow404Page(true)
            }
        }
        // retry: 3
    })
 
    const chatQuery = useInfiniteQuery(["chat", mafiaDetails.id], ({pageParam}) => getMessages({mafia: mafiaDetails.id, pageParam}), {
        enabled: false,
        getNextPageParam: (lastPage, ) => {
         
            if (lastPage.data.current < lastPage.data.pages){
                return lastPage.data.current + 1}
            
        },
        refetchOnWindowFocus: false,
        staleTime: Infinity,
        onError: (err) => {
            
            if (err.response?.status === 404){
                // setQueryEnabled(false)
                // setShow404Page(true)
            }
        },

    })

    const uploadMediaMessageMutation = useMutation(uploadChatMedia, {
        onSuccess: () => {
            resetMedia()
            setText("")
        },
        onError: () => {
            setTimedMessage("An error occurred. Try again later.")
        }
    })

    useEffect(() => {
        // update the title
        document.title = `LonersMafia | maifa - ${mafia}`

        if (mafia !== null){
            setMessages([])
            mafiaQuery.refetch()
            chatQuery.refetch()
            console.log("refetching")
        }
        return () => {
            document.title = `LonersMafia`
        }
    }, [mafia])

    useEffect(() => {

        const chatPages = []

        // console.log("Chat qyery: ", chatQuery.status, chatQuery.data)
        if (chatQuery.status === "success"){
            chatQuery.data.pages?.forEach((x) => {
                x.data.results?.forEach( (x) =>{
                    chatPages.push(x)
                }
                )      
            })
            
            /* NOTE: 
            The below commented line removes the duplicate just incase and displays it in the latest order.
            The duplicate value arises because when there is a new message through websocket, we are not
            fetching the same page again(because we don't need to). 
            For example: page1 contains ids: {58, 57, 56} and page 2 has: {55, 54, 53}
            Now a new message is added through websocket. So
            The page1 has ids {59, 58, 57} and page2: has {56, 55, 54} but the 56 was already there in the 
            messages which leads to data duplication and makes it unusable as key for list elements.
            */
            const chat_pages = [...chatPages.reverse(), ...messages].filter((value, index, a) =>
            index === a.findIndex((t) => (t.id === value.id))
            )

            setMessages(chat_pages)
            // console.log("Messages: ", chat_pages)
            
        }
    }, [chatQuery.status, chatQuery.data, chatQuery.isFetched])
    
    useEffect(() => {

        if (!localStorage.getItem("sent-first-message")){
            setText(randomTexts[randInt(0, randomTexts.length-1)])
        }

    }, [])

    useEffect(() => {

        if (sessionStorage.getItem("websocket-reconnect") === "true"){

            getWebSocket()?.close(1000)
            console.log("Closed")
            sessionStorage.removeItem("websocket-reconnect")
        }

    }, [sessionStorage.getItem("websocket-reconnect")])
    
    useEffect(() => {

        if (mafia !== null){
            setSocketUrl(`${process.env.REACT_APP_WEBSOCKET_ENDPOINT}/mafia/${mafia}/`) //eg: ws://localhost:8000/ws/mafia/mafia/
            // setQueryEnabled(true)
            console.log("2: ")
            chatQuery.refetch()
        }
    }, [mafia])

    useEffect(() => {

        if (mafiaQuery.isSuccess){
            const data = mafiaQuery.data
            
            setMafiaDetails(data.data)

            sessionStorage.setItem("is_staff", data.data?.is_staff.toString())
            sessionStorage.setItem("is_mod", data.data?.is_mod.toString())

            const {background_image, color_theme} = mafiaQuery.data?.data
            
            docElementStyle.setProperty("--chat-background", color_theme)
            docElementStyle.setProperty("--chat-background-img", `url(${background_image})`)

            if (mafia !== null){
                // setQueryEnabled(true)
                console.log("3")
                chatQuery.refetch()
            }
        }

    }, [mafiaQuery.isSuccess, mafiaQuery.isRefetching, mafiaQuery.data?.data])

    useEffect(() => {
        
        if (lastJsonMessage && !messages.some(msg => lastJsonMessage.id === msg.id)){

            if (Object.keys(lastJsonMessage)[0] !== 'delete'){
                setMessages([...messages, lastJsonMessage])
                
                //NOTE
                /**
                 * NOTE: HACK to update the cache. The cache is not perfectly updated, there will be
                 * ubnormalities in the cached data, but it works, so Ok. Updating paginated cache, 
                 * without invalidating the cache is hard. 
                 * I am not going to break my head anymore on this if you have a 
                 * better solution give a pull request
                 */ 
                
                queryClient.setQueryData(["chat", mafiaDetails.id], ({pages, pagesParams}) => {
                    
                    pages[0].data.results.unshift(lastJsonMessage)
                    return ({
                        pagesParams,
                        pages: pages
                        })

                    }
                
                )
            }
            
            else if (Object.keys(lastJsonMessage)[0] === 'delete'){
                
                // FIXME: if too many messages are removed then 404 error is thrown because the page becomes empty.
                
                queryClient.setQueryData(["chat", mafiaDetails.id], ({pages, pagesParams}) => {
            

                    // updates all the cached rooms to display the latest message and change the unread count
                    const newPagesArray = pages.map((data) =>{
                                        // find and update the specific data
                                        const index = data.data.results.findIndex((val) => {
                                            // find the index and update the cache
    
                                            return val.id == lastJsonMessage.delete
                                        })
                                        
                                        if (index !== -1){
                                            // if the id exists in this page then delete the data
                                            const element = data.data.results.splice(index, 1)
                                        
                                        }

                                        return data
                                    }) 
                        
                    return {
                        pages: newPagesArray,
                        pageParams: pagesParams
                    }
                    
                    
                })


                const index = messages.findIndex((val) => {
                    // find the index and update the cache
                    return val.id == lastJsonMessage.delete
                })
                
                if (index !== -1){
                    const new_array = messages
                    new_array.splice(index, 1)
                    setMessages(new_array)
                }
            }

        } 

    }, [lastJsonMessage])

    useEffect(() => {
        // when there is a new message scroll to the bottom if the scrollbar is already at bottom
        // console.log("scroll to bottom")
        if (scrollToEnd)
            scrollToBottom()

    }, [messages])
    
    useEffect(() => {

        if (!window.navigator.onLine){
            setTimedMessage("You are not connected to internet")
        }

    }, [window.navigator.onLine])

    const currentUserId = useMemo(() => localStorage.getItem("user-id"), [localStorage.getItem("user-id")])
    
    const user_is_mod = useMemo(() => {
        return JSON.parse(sessionStorage.getItem("is_mod"))
    }, [sessionStorage.getItem("is_mod")])

    const user_is_staff = useMemo(() => {
        return JSON.parse(sessionStorage.getItem("is_staff"))
    }, [sessionStorage.getItem("is_staff")])

    const resetMedia = () => {
        
        setMedia({fileObject: null, fileUrl: null, fileType: ''})
                                        
        if (mediaRef.current)
            mediaRef.current.value = null

    }

    const sumbitMessage = () => {

        if (!navigator.onLine && process.env.NODE_ENV === "production"){
            setTimedMessage("You are offline :(")
            return 
        }

        if (!localStorage.getItem("user-id")){ // if the user hasn't logged in return
            return
        }

        if (readyState == ReadyState.CONNECTING){
            setTimedMessage("Connecting please wait..")
            return 
        }

        if (readyState == ReadyState.CLOSED){
            setTimedMessage("connection closed. Try refreshing the page or try again later.")
            return 
        }
        
        // if there is media content the send through http endpoint else send through websocket
        if (media.fileObject){

            const formData = new FormData()
           
            formData.append("mafia", mafiaDetails.id)
            formData.append("media", media.fileObject)
            
            if (text.trim())
                formData.append("message", text.trim())

            uploadMediaMessageMutation.mutate(formData)

        }

        else{

            console.log("Sending...")

            if (!text.trim())
                return

            

            sendJsonMessage({
                "message": text.trim()
            })
            console.log("Sending...2")

            setText("")
        }

        localStorage.setItem("sent-first-message", "true") // once the user has sent his/her first message stop setting random text to text box
    }

    const scrollToBottom = () => {

        if (scrollRef.current)
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            
    }

    const handleChatScroll = (e) =>{
        const bottom = e.target.scrollHeight - e.target.scrollTop <= (e.target.clientHeight + 50)
  
        if (!bottom && scrollToEnd){
            setScrollToEnd(false)
        }

        else if(!scrollToEnd && bottom){
            setScrollToEnd(true)
        }

        // console.log("Target: ", e.target.scrollTop, chatQuery.status)
        if (e.target.scrollTop < 40 && (chatQuery.status === "loading" || chatQuery.isFetching)){ // prevent completely from scrolling top top when loading
            e.target.scrollTop = 40
        }

        // If the scroll-bar is at the top then fetch old messages from the database
        // note: we may also have to check if scroll bar is scrolling to the top
        if (scrollRef.current && (100 >= scrollRef.current.scrollTop 
            || scrollRef.current.clientHeight === scrollRef.current.scrollHeight) 
            && (chatQuery.hasNextPage === undefined || chatQuery.hasNextPage === true)) {
                console.log("fetching the next")
                chatQuery.fetchNextPage({cancelRefetch: false})
        }        
    }

    const onBanSuccess = (userid) => {
        
        queryClient.setQueryData(["chat", mafiaDetails.id], (data) => {
            
            // updates all the cache and sets banned to true
            const newPagesArray = data.pages.map((data) =>{
                                // find and update the specific data
                                // console.log("deleted data: ", data.data.results)
                                data.data.results.map((result, index) => {
                                    // console.log("Banned: ",  result.user.id, currentUserId)
                                    if (result?.user?.id == userid){ // update all cache where userid= user and mafia id= mafiaid
                                        data.data.results[index].is_banned = true
                                        // console.log("Banned2: ", data.data.results[index])
                                    }
                                    return result
                                })
                                    

                                return data
                                }) 
                
            return {
                pages: newPagesArray,
                pageParams: data.pageParams
            }
        })

    }

    // console.log("404: ", show404Page)
    return (
        <>
        { !show404Page ?  
        
            <div className="chat-page">

                <ChatHeader onMaifaUpdate={() => {mafiaQuery.remove(); mafiaQuery.refetch()}} 
                                props={mafiaDetails}/>

                {
                    timedMesage !== ""?
                        <TimedMessageModal message={timedMesage} timeout={2000} onTimeOut={() => setTimedMessage("")}/>
                    :
                        null
                }
                <div className="chat-body" ref={scrollRef} onScroll={handleChatScroll}>

                    {
                        (navigator.onLine && (chatQuery.isLoading || chatQuery.isFetching)) ? 
                            <LoadingWheel />
                            :
                        null
                    }

                    {
                        (!navigator.onLine) ? 

                            <div className="row center">
                                you are not connected to the internet
                            </div>
                        :
                        null
                    }

                    {
                        messages.map((msg) => {
                    
                            return (<li key={msg.id}>
                                        <ChatCard 
                                            currentUserId={currentUserId}
                                            user_is_mod={user_is_mod}
                                            user_is_staff={user_is_staff}
                                            onBanSuccess={onBanSuccess}
                                            props={msg}/>
                                    </li>)  
                        })
                    }
                </div>

                <div ref={lastMessageRef}/>
                
                {   media.fileObject ?
                    
                    <div className="media-container column margin-4px">
                        {/* <img src={ICONS.close_button}
                            alt="close"
                            className="close-btn"
                            onClick={removeMedia}    
                            /> */}
                       {
                       
                        !uploadMediaMessageMutation.isLoading ?
                            <CLOSE className="close-btn" 
                                onClick={resetMedia}/>
                            :
                        null
                        }
                        {media.fileType === "video"? 
                            <video controls className="media">
                                <source src={media.displayFile} type="video/mp4" alt="Video"/>
                                Video is missing
                            </video>
                            : 
                            <img src={media.fileUrl} className="media" alt="image"/>
                        }
                        <div className="margin-10px"/>
                        {uploadMediaMessageMutation.isLoading ? <LoadingWheel /> : null}
                    </div>
                    :
                    null
                }

                {    
                    
                    messagable ? 
                    <div className="message-container">
                        
                        <AutoHeightTextarea 
                            value={text}
                            maxLength={MAX_LENGTH.chat_length} 
                            mediaRef={mediaRef}
                            onChange={e => {setText(e.target.value)}}
                            onMediaUpload={(media) => setMedia(media)}
                            onFileUploadError={(err) => setTimedMessage(err)}
                            onInfo={(info) => setTimedMessage(info)}
                            disabled={uploadMediaMessageMutation.isLoading}
                            onSendOnEnter={sumbitMessage}
                        />
                    
                        <button className="send-btn" onClick={sumbitMessage}> 
                            <SEND fill="#fff"/>
                        </button>
                    
                    </div>
                    :
                    <div className="message-container margin-10px row center font-18px">
                        {socketCloseReason}
                    </div>
                }
            </div>
            
            :

            <Error404 />
            
            }

        </>
    )

}