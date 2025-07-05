import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const ProfilePicture = ({ user }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  if (!user?.photoURL || imageError) {
    return (
      <View style={styles.profilePicFallback}>
        <Text style={styles.profilePicInitials}>
          {getInitials(user?.displayName)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.profilePicContainer}>
      <Image
        source={{ uri: user.photoURL }}
        style={[styles.profilePic, isLoading && styles.profilePicLoading]}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      {isLoading && (
        <View style={styles.profilePicLoader}>
          <Text style={styles.profilePicInitials}>
            {getInitials(user?.displayName)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  profilePicContainer: {
    position: 'relative',
  },
  profilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profilePicLoading: {
    opacity: 0,
  },
  profilePicLoader: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicInitials: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ProfilePicture;
