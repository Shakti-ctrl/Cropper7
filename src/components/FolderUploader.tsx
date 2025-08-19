import React, { useRef } from 'react';

interface FolderUploaderProps {
  onFoldersSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

export const FolderUploader: React.FC<FolderUploaderProps> = ({
  onFoldersSelected,
  accept = "image/*",
  multiple = true,
  children,
  disabled = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFolderUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFoldersSelected(files);
    }
    // Reset the input value so the same folder can be selected again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <>
      <div onClick={handleClick} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {children}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        {...({webkitdirectory: '', directory: ''} as any)}
        style={{ display: 'none' }}
        onChange={handleFolderUpload}
        disabled={disabled}
      />
    </>
  );
};