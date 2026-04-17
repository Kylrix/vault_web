"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Drawer,
    DialogTitle,
    DialogContent,
    Typography,
    Button,
    TextField,
    Box,
    IconButton,
    CircularProgress,
    Stack,
    alpha,
    InputAdornment,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import CloseIcon from "@mui/icons-material/Close";
import ShieldIcon from "@mui/icons-material/Shield";
import Logo from "../common/Logo";
import { AppwriteService } from "@/lib/appwrite";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import { PasskeySetup } from "./passkeySetup";
import { useAppwriteVault } from "@/context/appwrite-context";
import toast from "react-hot-toast";
import { masterPassCrypto } from "@/app/(protected)/masterpass/logic";
import React from "react";
import { unlockWithPasskey } from "@/lib/passkey";
import { useRouter } from "next/navigation";

interface SudoModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    onCancel: () => void;
    intent?: "unlock" | "initialize" | "reset";
}

const VAULT_PRIMARY = "#10B981"; // Emerald
const BG_COLOR = "#0A0908";
const SURFACE_COLOR = "#161412";

export function SudoModal({
    isOpen,
    onSuccess,
    onCancel,
    intent,
}: SudoModalProps) {
    const { user } = useAppwriteVault();
    const router = useRouter();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [hasPasskey, setHasPasskey] = useState(false);
    const [mode, setMode] = useState<"passkey" | "password" | "initialize" | "reset" | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);
    const [confirmPhase, setConfirmPhase] = useState(0);

    const handleConfirmStep = () => {
        if (confirmPhase < 2) {
            setConfirmPhase(prev => prev + 1);
        } else {
            handleSuccessWithSync();
        }
    };

    const handleSuccessWithSync = useCallback(async () => {
        onSuccess();

        if (user?.$id) {
            try {
                // Sudo Hook: Ensure E2E Identity is created and published upon successful MasterPass unlock
                console.log("Synchronizing Identity...");
                await ecosystemSecurity.ensureE2EIdentity(user.$id);

                if (intent === "reset") {
                    // If reset intent, we already called onSuccess above
                    return;
                }

                // Incentive: If user doesn't have a passkey, show incentive (7-day snooze)
                const entries = await AppwriteService.listKeychainEntries(user.$id);
                const hasPasskey = entries.some((e: any) => e.type === 'passkey');
                const isKylrixDomain = typeof window !== 'undefined' && 
                    (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));

                if (!hasPasskey && isKylrixDomain) {
                    const lastSkip = localStorage.getItem(`passkey_skip_${user.$id}`);
                    const sevenDays = 7 * 24 * 60 * 60 * 1000;
                    if (!lastSkip || (Date.now() - parseInt(lastSkip)) > sevenDays) {
                        setShowPasskeyIncentive(true);
                    }
                }
            } catch (e) {
                console.error("Failed to sync identity on unlock", e);
            }
        }
    }, [user?.$id, onSuccess, intent]);

    const handlePasskeyVerify = useCallback(async () => {
        if (!user?.$id || !isOpen) return;
        setPasskeyLoading(true);
        try {
            const success = await unlockWithPasskey(user.$id);
            if (success && isOpen) {
                toast.success("Verified via Passkey");
                handleSuccessWithSync();
            }
        } catch (e) {
            console.error("Passkey verification failed or cancelled", e);
        } finally {
            setPasskeyLoading(false);
        }
    }, [user?.$id, isOpen, handleSuccessWithSync]);

    const handleInitializeMasterPass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.$id || !user?.email) return;

        setLoading(true);
        try {
            // 1. Generate new MEK
            const mek = await ecosystemSecurity.generateRandomMEK();
            
            // 2. Wrap it with the password
            const salt = crypto.getRandomValues(new Uint8Array(32));
            const wrappedKey = await ecosystemSecurity.wrapMEK(mek, password, salt);
            
            // 3. Create Keychain Entry
            await AppwriteService.createKeychainEntry({
                userId: user.$id,
                type: 'password',
                credentialId: null,
                wrappedKey: wrappedKey,
                salt: btoa(String.fromCharCode(...salt)),
                params: JSON.stringify({ iterations: 600000, hash: "SHA-256" }),
                isBackup: false
            } as any);

            // 4. Set Masterpass Flag on User Doc
            await AppwriteService.setMasterpassFlag(user.$id, user.email);
            
            // 5. Unlock locally
            const rawMek = await crypto.subtle.exportKey("raw", mek);
            await masterPassCrypto.importKey(rawMek);
            await masterPassCrypto.unlockWithImportedKey();

            toast.success("MasterPass initialized successfully");
            handleSuccessWithSync();
        } catch (err) {
            console.error(err);
            toast.error("Initialization failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordVerify = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!user?.$id) return;

        setLoading(true);
        try {
            const isValid = await masterPassCrypto.unlock(password, user.$id);
            if (isValid) {
                toast.success("Identity Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect master password");
            }
        } catch (_error: unknown) {
            console.error(_error);
            toast.error("Verification failed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && user?.$id) {
            const isKylrixDomain = typeof window !== 'undefined' && 
                (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));

            AppwriteService.listKeychainEntries(user.$id).then(entries => {
                const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
                const passwordPresent = entries.some((e: any) => e.type === 'password');
                
                // Disable passkey if not on kylrix.space domain
                const effectivePasskeyPresent = passkeyPresent && isKylrixDomain;
                
                setHasPasskey(effectivePasskeyPresent);

                if (intent === "initialize") {
                    if (passwordPresent) {
                        toast.error("MasterPass is already setup. Use reset if needed.");
                        setMode("password");
                    } else {
                        setMode("initialize");
                    }
                    setIsDetecting(false);
                    return;
                }

                if (intent === "reset") {
                    if (effectivePasskeyPresent) {
                        setMode("passkey");
                    } else {
                        setMode("password");
                    }
                    setIsDetecting(false);
                    return;
                }

                if (!passwordPresent && isOpen) {
                    setMode("initialize");
                    setIsDetecting(false);
                    return;
                }

                if (effectivePasskeyPresent) {
                    setMode("passkey");
                } else {
                    setMode("password");
                }
                setIsDetecting(false);
            }).catch(() => {
                setIsDetecting(false);
                setMode("password");
            });

            setPassword("");
            setLoading(false);
            setPasskeyLoading(false);
            setIsDetecting(true);
            setConfirmPhase(0);
        }
    }, [isOpen, user?.$id, intent]);

    useEffect(() => {
        if (isOpen && mode === "passkey" && hasPasskey && !passkeyLoading) {
            handlePasskeyVerify();
        }
    }, [isOpen, mode, hasPasskey, handlePasskeyVerify, passkeyLoading]);

    if (showPasskeyIncentive && user) {
        return (
            <PasskeySetup
                isOpen={true}
                onClose={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess(); // Use the original onSuccess when skipping incentive
                }}
                userId={user.$id}
                onSuccess={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess(); // Use original onSuccess after setup too
                }}
                trustUnlocked={true}
            />
        );
    }

    return (
        <Drawer
            open={isOpen}
            onClose={onCancel}
            anchor={isDesktop ? "right" : "bottom"}
            ModalProps={{ keepMounted: true }}
            sx={{ zIndex: 2200 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: isDesktop ? '32px' : '32px',
                    borderTopRightRadius: isDesktop ? 0 : '32px',
                    borderBottomLeftRadius: isDesktop ? '32px' : 0,
                    borderBottomRightRadius: 0,
                    bgcolor: BG_COLOR,
                    backdropFilter: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    backgroundImage: 'none',
                    boxShadow: '0 32px 64px rgba(0, 0, 0, 0.8)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    width: isDesktop ? 'min(100vw, 460px)' : '100%',
                    maxWidth: '100vw',
                    height: isDesktop ? '100dvh' : 'auto',
                    maxHeight: isDesktop ? '100dvh' : 'calc(100dvh - 12px)',
                }
            }}
        >
            <style>{`
                @keyframes race {
                    from { stroke-dashoffset: 240; }
                    to { stroke-dashoffset: 0; }
                }
                @keyframes pulse-hex {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
            <DialogTitle sx={{ textAlign: 'center', pt: 5, pb: 1, position: 'relative', bgcolor: BG_COLOR }}>
                <IconButton
                    onClick={onCancel}
                    sx={{
                        position: 'absolute',
                        right: 20,
                        top: 20,
                        color: 'rgba(255, 255, 255, 0.3)',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                >
                    <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>

                <Box sx={{ position: 'relative', mb: 3, display: 'inline-flex' }}>
                    <Logo 
                        variant="icon" 
                        size={64} 
                        app="vault"
                        sx={{ 
                            borderRadius: '16px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                            bgcolor: BG_COLOR
                        }} 
                    />
                    <Box sx={{
                        position: 'absolute',
                        bottom: -8,
                        right: -8,
                        width: 32,
                        height: 32,
                        borderRadius: '10px',
                        bgcolor: VAULT_PRIMARY,
                        color: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${alpha(VAULT_PRIMARY, 0.4)}`,
                        border: `3px solid ${BG_COLOR}`,
                        zIndex: 1
                    }}>
                        <LockIcon sx={{ fontSize: 16 }} />
                    </Box>
                </Box>
                <Typography variant="h5" sx={{
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    fontFamily: 'var(--font-clash)',
                    color: 'white'
                }}>
                    {user?.name || "User"}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', mt: 1, fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                    Security verification required
                </Typography>
            </DialogTitle>

            <DialogContent sx={{ pb: 4, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', bgcolor: BG_COLOR }}>
                {intent === "reset" && mode === "password" ? (
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Box sx={{
                            p: 2,
                            borderRadius: '16px',
                            bgcolor: alpha('#ef4444', 0.1),
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}>
                            <Typography variant="body2" sx={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ShieldIcon sx={{ fontSize: 16 }} /> RESET CONFIRMATION
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5, display: 'block', fontWeight: 600 }}>
                                {confirmPhase === 0 
                                    ? "Resetting your master password will permanently wipe all your encrypted data (Tier 2)." 
                                    : confirmPhase === 1 
                                    ? "This action is irreversible. You will lose access to all your credentials and secrets."
                                    : "Final Step: Once you click below, your data will be queued for deletion."}
                            </Typography>
                        </Box>

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleConfirmStep}
                            disabled={loading}
                            sx={{
                                py: 1.5,
                                borderRadius: '14px',
                                bgcolor: '#ef4444',
                                color: '#fff',
                                fontWeight: 800,
                                '&:hover': { bgcolor: alpha('#ef4444', 0.8) }
                            }}
                        >
                            {confirmPhase === 0 
                                ? "I understand, continue" 
                                : confirmPhase === 1 
                                ? "Yes, I am sure"
                                : "Proceed to Wipe Everything"}
                        </Button>

                        <Button 
                            variant="text" 
                            size="small" 
                            onClick={onCancel} 
                            sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700 }}
                        >
                            Wait, cancel this
                        </Button>
                    </Stack>
                ) : isDetecting || passkeyLoading ? (
                    <Stack spacing={3} sx={{ mt: 4, mb: 2, alignItems: 'center' }}>
                        <CircularProgress size={48} sx={{ color: VAULT_PRIMARY }} />
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 800, letterSpacing: '0.1em' }}>
                                {passkeyLoading ? "AUTHENTICATING..." : "PREPARING SECURITY CHECK..."}
                            </Typography>
                        </Box>
                        {passkeyLoading && (
                            <Button
                                fullWidth
                                variant="text"
                                size="small"
                                onClick={() => setMode("password")}
                                sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, '&:hover': { color: 'white' } }}
                            >
                                Use Master Password
                            </Button>
                        )}
                    </Stack>
                ) : mode === "initialize" ? (
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <form onSubmit={handleInitializeMasterPass}>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block' }}>
                                        SET MASTER PASSWORD
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        placeholder="Create a strong password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoFocus
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.3)" }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '14px',
                                                bgcolor: SURFACE_COLOR,
                                                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                                                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                                '&.Mui-focused fieldset': { borderColor: VAULT_PRIMARY },
                                            },
                                            '& .MuiInputBase-input': { color: 'white' }
                                        }}
                                    />
                                </Box>

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    disabled={loading || !password || password.length < 8}
                                    sx={{
                                        py: 2,
                                        borderRadius: '16px',
                                        bgcolor: VAULT_PRIMARY,
                                        color: '#000',
                                        fontWeight: 900,
                                        fontFamily: 'var(--font-space-grotesk)',
                                        textTransform: 'none',
                                        boxShadow: `0 8px 25px ${alpha(VAULT_PRIMARY, 0.3)}`,
                                        '&:hover': {
                                            bgcolor: alpha(VAULT_PRIMARY, 0.9),
                                            transform: 'translateY(-1px)',
                                            boxShadow: `0 12px 30px ${alpha(VAULT_PRIMARY, 0.4)}`
                                        }
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : "Initialize Ecosystem Vault"}
                                </Button>
                                
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', textAlign: 'center', mt: 1, fontWeight: 500 }}>
                                    Your MasterPass is the key to all your secure data. <br/> It cannot be recovered if lost.
                                </Typography>
                            </Stack>
                        </form>
                    </Stack>
                ) : mode === "passkey" ? (
                    <Stack spacing={3} sx={{ mt: 2, alignItems: 'center' }}>
                        <Box
                            onClick={handlePasskeyVerify}
                            sx={{
                                width: 80,
                                height: 80,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'scale(1.05)'
                                }
                            }}
                        >
                            <svg width="80" height="80" viewBox="0 0 80 80">
                                <path
                                    d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                                    fill="transparent"
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth="2"
                                    strokeDasharray="4 4"
                                />
                                {passkeyLoading && (
                                    <path
                                        d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                                        fill="transparent"
                                        stroke="url(#racingGradient)"
                                        strokeWidth="3"
                                        strokeDasharray="60 180"
                                        style={{
                                            animation: 'race 2s linear infinite'
                                        }}
                                    />
                                )}
                                <defs>
                                    <linearGradient id="racingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={VAULT_PRIMARY} />
                                        <stop offset="100%" stopColor={alpha(VAULT_PRIMARY, 0.6)} />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <Box sx={{
                                position: 'absolute',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: passkeyLoading ? 'pulse-hex 2s infinite ease-in-out' : 'none'
                            }}>
                                <FingerprintIcon sx={{ fontSize: 32, color: passkeyLoading ? VAULT_PRIMARY : 'rgba(255, 255, 255, 0.4)' }} />
                            </Box>
                        </Box>

                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            {passkeyLoading ? "CONFIRM ON DEVICE" : "TAP TO VERIFY"}
                        </Typography>

                        <Box sx={{ width: '100%', position: 'relative', py: 1 }}>
                            <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                            <Typography variant="caption" sx={{
                                position: 'relative',
                                bgcolor: BG_COLOR,
                                px: 2,
                                mx: 'auto',
                                display: 'table',
                                color: 'rgba(255, 255, 255, 0.3)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                fontWeight: 800
                            }}>
                                Or
                            </Typography>
                        </Box>

                        <Button
                            fullWidth
                            variant="text"
                            size="small"
                            onClick={() => setMode("password")}
                            sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, '&:hover': { color: 'white' } }}
                        >
                            Use Master Password
                        </Button>
                    </Stack>
                ) : (
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <form onSubmit={handlePasswordVerify}>
                            <Stack spacing={2.5}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block' }}>
                                        MASTER PASSWORD
                                    </Typography>
                                    <TextField
                                        fullWidth
                                        type="password"
                                        placeholder="Enter your master password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoFocus
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <LockIcon sx={{ fontSize: 18, color: "rgba(255, 255, 255, 0.3)" }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '14px',
                                                bgcolor: SURFACE_COLOR,
                                                '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                                                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                                '&.Mui-focused fieldset': { borderColor: VAULT_PRIMARY },
                                            },
                                            '& .MuiInputBase-input': { color: 'white' }
                                        }}
                                    />
                                </Box>

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    disabled={loading || !password}
                                    sx={{
                                        py: 2,
                                        borderRadius: '16px',
                                        bgcolor: VAULT_PRIMARY,
                                        color: '#000',
                                        fontWeight: 900,
                                        fontFamily: 'var(--font-space-grotesk)',
                                        textTransform: 'none',
                                        boxShadow: `0 8px 25px ${alpha(VAULT_PRIMARY, 0.3)}`,
                                        '&:hover': {
                                            bgcolor: alpha(VAULT_PRIMARY, 0.9),
                                            transform: 'translateY(-2px)',
                                            boxShadow: `0 12px 30px ${alpha(VAULT_PRIMARY, 0.4)}`
                                        }
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : "Confirm Security Entry"}
                                </Button>
                            </Stack>
                        </form>


                        <Box sx={{ width: '100%', position: 'relative', py: 1.5 }}>
                            <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.05)' }} />
                            <Typography variant="caption" sx={{
                                position: 'relative',
                                bgcolor: BG_COLOR,
                                px: 2.5,
                                mx: 'auto',
                                display: 'table',
                                color: 'rgba(255, 255, 255, 0.25)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.15em',
                                fontFamily: 'var(--font-space-grotesk)',
                                fontSize: '0.65rem',
                                fontWeight: 800
                            }}>
                                Or
                            </Typography>
                        </Box>

                        {hasPasskey && (
                            <Button
                                fullWidth
                                variant="text"
                                startIcon={<FingerprintIcon sx={{ fontSize: 18 }} />}
                                onClick={() => {
                                    setMode("passkey");
                                }}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    py: 1.5,
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    fontWeight: 700,
                                    '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.15)' }
                                }}
                            >
                                Use Passkey
                            </Button>
                        )}

                        {mode === "password" && intent !== "reset" && (
                            <Button
                                fullWidth
                                variant="text"
                                size="small"
                                onClick={() => router.push('/masterpass/reset')}
                                sx={{ color: '#ef4444', '&:hover': { bgcolor: alpha('#ef4444', 0.1) }, mt: 2, fontWeight: 700 }}
                            >
                                Reset Master Password
                            </Button>
                        )}
                    </Stack>
                )}
            </DialogContent>
        </Drawer>
    );
}
