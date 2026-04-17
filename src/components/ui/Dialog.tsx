import { ReactNode } from "react";
import { Dialog as MuiDialog, DialogContent, IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

export function Dialog({
  open,
  onClose,
  children,
  _className = "",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  _className?: string;
}) {
  return (
    <MuiDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          backgroundImage: 'none',
          color: 'white',
          position: 'relative',
          overflow: 'visible'
        }
      }}
      sx={{
        '& .MuiBackdrop-root': {
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)'
        }
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: 'absolute',
          right: 16,
          top: 16,
          color: 'rgba(255, 255, 255, 0.4)',
          zIndex: 10,
          '&:hover': {
            color: 'white',
            bgcolor: 'rgba(255, 255, 255, 0.05)'
          }
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>
      <DialogContent sx={{ p: 0 }}>
        {children}
      </DialogContent>
    </MuiDialog>
  );
}
