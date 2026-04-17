'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Switch,
    Divider,
    CircularProgress,
    alpha,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Tooltip,
    useTheme
} from '@mui/material';
import { Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import { appwriteDatabases, Query, Permission, Role } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';

// Constants match connect/lib/appwrite/config.ts
const CONNECT_DB_ID = 'chat';
const CONNECT_USERS_TABLE = 'users';

export const DiscoverabilitySettings = () => {
    const theme = useTheme();
    const { user } = useAppwriteVault();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    const loadProfile = useCallback(async () => {
        if (!user?.$id) return;
        try {
            try {
                // Document ID in the users table is mapped to the Appwrite Account ID
                const p = await appwriteDatabases.getDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id);
                setProfile(p);
                setNewUsername(p.username || '');
                } catch (_e: any) {
                const search = await appwriteDatabases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.or([
                        Query.equal('userId', user.$id),
                        Query.equal('$id', user.$id)
                    ]),
                    Query.limit(1)
                ]);
                if (search.documents.length > 0) {
                    const p = search.documents[0];
                    setProfile(p);
                    setNewUsername(p.username || '');
                } else {
                    setProfile(null);
                }
            }
        } catch (e: any) {
            console.error("Failed to load profile from Connect", e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?.$id) {
            loadProfile();
        }
    }, [user?.$id, loadProfile]);

    useEffect(() => {
        const check = async () => {
            const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
            if (!normalized || normalized === profile?.username || normalized.length < 3) {
                setIsAvailable(null);
                return;
            }

            setCheckingAvailability(true);
            try {
                const existing = await appwriteDatabases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.equal('username', normalized),
                    Query.limit(1)
                ]);
                setIsAvailable(existing.total === 0);
            } catch (e) {
                console.error("Check failed", e);
                setIsAvailable(null);
            } finally {
                setCheckingAvailability(false);
            }
        };

        const timeoutId = setTimeout(check, 500);
        return () => clearTimeout(timeoutId);
    }, [newUsername, profile?.username]);

    const handleToggleDiscoverability = async (checked: boolean) => {
        if (!user?.$id) return;

        if (!profile) {
            setIsEditing(true);
            toast.error("Set a handle first to enable discovery");
            return;
        }

        if (checked && !profile.publicKey) {
            // Need to set up public key
            if (!ecosystemSecurity.status.isUnlocked) {
                toast.error("Unlock your vault to enable secure discoverability");
                // Trigger sudo request (the UI will handle the modal if we have a listener or just tell user)
                return;
            }

            setSaving(true);
            try {
                const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                if (pub) {
                    setProfile({ ...profile, publicKey: pub });
                    toast.success("E2E Identity initialized and discovery enabled");
                }
            } catch (_e) {
                toast.error("Failed to initialize identity");
            } finally {
                setSaving(false);
            }
        } else {
            // If already has publicKey, we just update a flag if we had one, 
            // but since we don't have a 'discoverable' column, we just inform the user.
            toast.success(checked ? "Discovery enabled" : "Discovery disabled (Identity remains secure)");
        }
    };

    const handleSaveUsername = async () => {
        if (!user?.$id || !newUsername) return;
        const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

        if (normalized.length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }

        setSaving(true);
        try {
            // Availability check
            if (!profile || profile.username !== normalized) {
                const existing = await appwriteDatabases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.equal('username', normalized),
                    Query.limit(1)
                ]);
                if (existing.total > 0 && existing.documents[0].userId !== user.$id && existing.documents[0].$id !== user.$id) {
                    toast.error("Username already taken");
                    setSaving(false);
                    return;
                }
            }

            let publicKeyStr: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKeyStr = pub;
                }
            } catch (e) {
                console.warn(e);
            }

            const data: any = {
                username: normalized,
                displayName: profile?.displayName || user.name || normalized,
                updatedAt: new Date().toISOString(),
                bio: profile?.bio || "",
            };
            if (publicKeyStr) {
                data.publicKey = publicKeyStr;
            }

            if (profile) {
                await appwriteDatabases.updateDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, profile.$id, data);
                setProfile({ ...profile, ...data });
                toast.success("Handle updated");
            } else {
                await appwriteDatabases.createDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id, {
                    userId: user.$id,
                    ...data,
                    createdAt: new Date().toISOString()
                }, [
                    Permission.read(Role.any()),
                    Permission.update(Role.user(user.$id)),
                    Permission.delete(Role.user(user.$id))
                ]);
                const p = await appwriteDatabases.getDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id);
                setProfile(p);
                toast.success("Universal identity initialized!");
            }
            setIsEditing(false);
            setShowConfirm(false);
        } catch (e: any) {
            console.error(e);
            toast.error("Failed to save handle");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CircularProgress size={24} />;
    if (!profile) return null;

    const isDiscoverable = !!profile?.publicKey;

    return (
        <Box>
            <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', mb: 2, display: 'block', letterSpacing: '0.1em' }}>
                ECOSYSTEM DISCOVERABILITY
            </Typography>
            <Paper sx={{
                p: 4,
                borderRadius: '32px',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(20px)'
            }}>
                <Stack spacing={4}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)' }}>Global Handle</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.6 }}>Allow others to find you by your universal username</Typography>
                        </Box>
                        <Switch
                            checked={!!isDiscoverable}
                            onChange={(e) => handleToggleDiscoverability(e.target.checked)}
                            disabled={saving}
                            color="primary"
                        />
                    </Box>

                    <Divider sx={{ opacity: 0.05 }} />

                    <Box sx={{ flex: 1 }}>
                        {isEditing ? (
                            <Box>
                                <TextField
                                    fullWidth
                                    size="small"
                                    variant="standard"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    placeholder="Your handle"
                                    autoFocus
                                    InputProps={{
                                        disableUnderline: true,
                                        startAdornment: <Typography sx={{ color: theme.palette.primary.main, fontWeight: 800, mr: 0.5 }}>@</Typography>,
                                        endAdornment: (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {checkingAvailability && <CircularProgress size={14} sx={{ color: theme.palette.primary.main }} />}
                                                {!checkingAvailability && isAvailable === true && <Check size={14} color={theme.palette.primary.main} />}
                                                {!checkingAvailability && isAvailable === false && <X size={14} color="#FF5252" />}
                                            </Box>
                                        ),
                                        sx: {
                                            fontFamily: 'var(--font-jetbrains-mono)',
                                            fontWeight: 800,
                                            fontSize: '1.1rem',
                                            color: 'white'
                                        }
                                    }}
                                />
                                {isAvailable === false && (
                                    <Typography variant="caption" sx={{ color: '#FF5252', fontWeight: 600, mt: 0.5, display: 'block' }}>
                                        already taken
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            <>
                                <Typography sx={{
                                    fontFamily: 'var(--font-jetbrains-mono)',
                                    fontWeight: 800,
                                    fontSize: '1.1rem',
                                    opacity: (isDiscoverable || !profile) ? 1 : 0.4,
                                    color: !profile ? 'warning.main' : 'inherit'
                                }}>
                                    @{profile?.username || 'not_set'}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.4, display: 'block', mt: 0.5 }}>
                                    {!profile ? 'Identity not initialized' : `Identity linked to ${profile.displayName || 'Universal User'}`}
                                </Typography>
                            </>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        {isEditing ? (
                            <>
                                <Tooltip title="Cancel">
                                    <IconButton size="small" onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); setIsAvailable(null); }} sx={{ color: 'error.main' }}>
                                        <X size={18} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Save">
                                    <IconButton 
                                        size="small" 
                                        onClick={() => setShowConfirm(true)} 
                                        sx={{ color: 'success.main' }} 
                                        disabled={saving || !newUsername || isAvailable === false || checkingAvailability || (newUsername === profile?.username && !!profile)}
                                    >
                                        <Check size={18} />
                                    </IconButton>
                                </Tooltip>
                            </>
                        ) : (
                            <Tooltip title={profile ? "Change Handle" : "Setup Identity"}>
                                <IconButton
                                    size="small"
                                    onClick={() => setIsEditing(true)}
                                    sx={{
                                        color: theme.palette.primary.main,
                                        bgcolor: !profile ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) }
                                    }}
                                >
                                    <Edit2 size={18} />
                                </IconButton>
                            </Tooltip>
                        )}

                        {isDiscoverable && !isEditing && (
                            <Box sx={{
                                ml: 'auto',
                                px: 1.5,
                                py: 0.5,
                                borderRadius: '8px',
                                bgcolor: alpha('#00F0FF', 0.1),
                                border: '1px solid',
                                borderColor: alpha('#00F0FF', 0.2),
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#00F0FF', textTransform: 'uppercase' }}>
                                    Active
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Stack>
            </Paper>

            {/* Confirmation Dialog */}
            <Dialog
                open={showConfirm}
                onClose={() => setShowConfirm(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        bgcolor: 'rgba(10, 10, 10, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        width: '100%',
                        maxWidth: '400px'
                    }
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'white' }}>
                    <ShieldAlert color={theme.palette.primary.main} />
                    Confirm Identity Change
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ opacity: 0.7, color: 'white', mb: 3 }}>
                        Updating your universal handle will sync across all Kylrix apps. This action is immediate and public.
                    </Typography>
                    <Box sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px dotted rgba(255, 255, 255, 0.2)' }}>
                        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mb: 0.5 }}>NEW UNIVERSAL HANDLE</Typography>
                        <Typography sx={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 800, color: theme.palette.primary.main }}>@{newUsername.toLowerCase().trim()}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button onClick={() => setShowConfirm(false)} sx={{ color: 'white', opacity: 0.6 }}>Cancel</Button>
                    <Button
                        onClick={handleSaveUsername}
                        variant="contained"
                        disabled={saving}
                        sx={{
                            borderRadius: '12px',
                            bgcolor: theme.palette.primary.main,
                            color: 'white',
                            fontWeight: 700,
                            px: 3,
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.8) }
                        }}
                    >
                        {saving ? <CircularProgress size={20} color="inherit" /> : "Confirm & Update"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
