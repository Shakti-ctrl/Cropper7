import {useEffect, useMemo} from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface Props {
  cropSize: any;
  file: any;
  index: number;
  onSetCropped: any
  onRemoveImage: any
  crops: any
  setCrops: any
  keepRatio: any
  lockMovement: any
  centerCrop: any
  onGlobalCropChange: any
  rearrangeMode?: boolean
}

const Cropper: React.FC<Props> = ({  crops, setCrops, cropSize, file, index, onSetCropped, onRemoveImage, keepRatio, lockMovement, centerCrop, onGlobalCropChange, rearrangeMode = false }) => {
  const crop = crops[index];
  const onSetCrops = (newCropSize: any = null) => {
    if(newCropSize == null) return;
    setCrops((prev:any)=> {
      const updatedCrop = {...prev[index], ...newCropSize, ...(keepRatio ? {aspect: 1} : {aspect: undefined})};
      
      // Trigger global crop change if lock movement is enabled
      if (lockMovement && onGlobalCropChange) {
        onGlobalCropChange(index, updatedCrop);
      }
      
      return {...prev, [index]: updatedCrop}
    })
  }

  useEffect(()=>{
    setCrops((prev:any)=> {
      return {...prev, [index]: {...prev[index], ...(keepRatio ? {aspect: 1} : {aspect: undefined})},
      }
    })
  }, [keepRatio])

  const imageToCrop= useMemo(()=>URL.createObjectURL(file), [file?.name])
  const croppedImage=(value: any) => onSetCropped(index, value)

  useEffect(()=>{
    // remove crop on unmount
    return () => {
      setCrops((prev:any)=> {
        const newValue = {...prev}
        if (newValue[index]) delete newValue[index]
        return newValue;
      })
    }
  }, [])

  useEffect(()=>{
    if(cropSize != null){
      onSetCrops(cropSize)
      console.log("set initial crop to", {cropSize})
    }
  }, [])

  const onSetCurrentCropSize =()=> onSetCrops(cropSize);

  const onImageLoaded = (loadedImage: any) => {
    setCrops((prev:any)=> {
      return {...prev, [index]: {...prev[index], image: loadedImage, name: file?.name, ...(cropSize ?? {})},
      }
    })
  }

  const cropperInfo = crop ? `W:${crop.width} H:${crop.height}  x:${crop.x} y:${crop.y}`: "";
  
  // Create a no-op function for rearrange mode to satisfy ReactCrop's onChange requirement
  const handleCropChange = rearrangeMode ? () => {} : onSetCrops;
  
  return (
      <div style={{borderRadius: "0.5rem", overflow: "hidden",
        flexShrink: 0,
        position: "relative"
      }} className="cropper"
           title={file?.name}
      >
        {/* Serial Number Badge */}
        <div style={{
          position: "absolute",
          top: "5px",
          left: "5px",
          background: rearrangeMode ? "#2196F3" : "#333",
          color: "white",
          borderRadius: "50%",
          width: "30px",
          height: "30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 200,
          fontSize: "14px",
          fontWeight: "bold",
          border: "2px solid white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
        }}>
          {index + 1}
        </div>
        
        <div className="cropper-header">
          <div className="cropper-filename">{file?.name}</div>
          {crop != null && <div className="cropper-info" title={cropperInfo}>{cropperInfo}</div>}
          <div className="cropper-body">
            {cropSize != null && <button onClick={onSetCurrentCropSize}>Set to {cropSize.width}x{cropSize.height}</button>}
            <button className="circle-button" onClick={()=>onRemoveImage(index)}>X</button>
          </div>
        </div>
            <ReactCrop
                key={file?.name}
                src={imageToCrop}
                onImageLoaded={onImageLoaded}
                crop={crop}
                onChange={handleCropChange}
                disabled={rearrangeMode}
            />
      </div>
  );
};

export default Cropper;
