import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserProfile, UserProfileUpdate, ChangePasswordRequest, UserDocument } from '@/types';

export function useProfile() {
  const queryClient = useQueryClient();
  const [currentScope, setCurrentScope] = useState<'all' | 'user' | 'conversation'>('all');

  // Fetch profile data
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: api.users.getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch documents with scope filter
  const {
    data: documents,
    isLoading: isLoadingDocuments,
    error: documentsError,
  } = useQuery<UserDocument[]>({
    queryKey: ['userDocuments'],
    queryFn: () => api.users.getDocuments(),
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Update profile mutation
  const updateProfile = useMutation({
    mutationFn: (data: UserProfileUpdate) => api.users.updateProfile(data),
    onSuccess: (updatedProfile) => {
      // Update the profile cache
      queryClient.setQueryData(['profile'], updatedProfile);
      
      // Also update the auth user if it exists
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: (data: ChangePasswordRequest) => api.users.changePassword(data),
    onSuccess: () => {
      // No cache updates needed for password change
      // Could show a success toast here
    },
  });

  // Upload document mutation
  const uploadDocument = useMutation({
    mutationFn: (file: File) => api.users.uploadDocument(file),
    onSuccess: () => {
      // Refetch documents list
      queryClient.invalidateQueries({ queryKey: ['userDocuments'] });
      
      // Also refetch profile to update document count
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  return {
    profile,
    documents,
    isLoadingProfile,
    isLoadingDocuments,
    profileError,
    documentsError,
    updateProfile,
    changePassword,
    uploadDocument,
    currentScope,
    setCurrentScope,
  };
}
