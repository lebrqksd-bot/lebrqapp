/**
 * Comprehensive Performance Team Profile Form
 * Allows admin/vendor to add/edit detailed performance team information
 */
import { CONFIG } from '@/constants/config';
import { UploadAPI } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ThemedText } from '../themed-text';

const API_BASE = CONFIG.API_BASE_URL;

export interface TeamMember {
  id?: string;
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
}

export interface PerformanceVideo {
  id?: string;
  title: string;
  url: string;
  thumbnail_url?: string;
}

export interface Achievement {
  id?: string;
  title: string;
  description: string;
  year?: string;
  image_url?: string;
}

export interface Experience {
  id?: string;
  event_name: string;
  event_type: string;
  date: string;
  location: string;
  description: string;
}

export interface PerformanceTeamProfile {
  // Basic Info
  team_name?: string;
  established_year?: string;
  total_experience?: string;
  
  // Detailed Description
  detailed_bio?: string;
  specialties?: string[];
  genres?: string[];
  
  // Team Members
  team_members?: TeamMember[];
  
  // Performance Videos
  performance_videos?: PerformanceVideo[];
  
  // Experience & History
  experience?: Experience[];
  notable_events?: string[];
  
  // Achievements & Awards
  achievements?: Achievement[];
  
  // Contact & Social
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  social_media?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  
  // Additional Info
  languages?: string[];
  performance_duration?: string;
  setup_time?: string;
  requirements?: string;
}

interface PerformanceTeamProfileFormProps {
  profile: PerformanceTeamProfile | null;
  onChange: (profile: PerformanceTeamProfile) => void;
  compact?: boolean;
  onValidationError?: (errors: Record<string, string>) => void;
  validateOnMount?: boolean;
}

export interface PerformanceTeamProfileFormRef {
  validate: () => boolean;
  scrollToError: () => void;
}

const PerformanceTeamProfileForm = React.forwardRef<PerformanceTeamProfileFormRef, PerformanceTeamProfileFormProps>(
  function PerformanceTeamProfileForm({
    profile,
    onChange,
    compact = false,
    onValidationError,
    validateOnMount = false,
  }, ref) {
  const [formData, setFormData] = useState<PerformanceTeamProfile>(
    profile || {
      team_members: [],
      performance_videos: [],
      achievements: [],
      experience: [],
      specialties: [],
      genres: [],
      languages: [],
      notable_events: [],
    }
  );
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const teamNameRef = useRef<TextInput>(null);
  const detailedBioRef = useRef<TextInput>(null);
  const teamNameViewRef = useRef<View>(null);
  const detailedBioViewRef = useRef<View>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        ...formData,
        ...profile,
        team_members: profile.team_members || [],
        performance_videos: profile.performance_videos || [],
        achievements: profile.achievements || [],
        experience: profile.experience || [],
        specialties: profile.specialties || [],
        genres: profile.genres || [],
        languages: profile.languages || [],
        notable_events: profile.notable_events || [],
      });
    }
  }, [profile]);

  const updateField = (field: keyof PerformanceTeamProfile, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onChange(updated);
  };

  const addTeamMember = () => {
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: '',
      role: '',
      bio: '',
      photo_url: '',
    };
    updateField('team_members', [...(formData.team_members || []), newMember]);
  };

  const updateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const members = [...(formData.team_members || [])];
    members[index] = { ...members[index], [field]: value };
    updateField('team_members', members);
  };

  const removeTeamMember = (index: number) => {
    const members = formData.team_members?.filter((_, i) => i !== index) || [];
    updateField('team_members', members);
  };

  const addVideo = () => {
    const newVideo: PerformanceVideo = {
      id: Date.now().toString(),
      title: '',
      url: '',
      thumbnail_url: '',
    };
    updateField('performance_videos', [...(formData.performance_videos || []), newVideo]);
  };

  const updateVideo = (index: number, field: keyof PerformanceVideo, value: string) => {
    const videos = [...(formData.performance_videos || [])];
    videos[index] = { ...videos[index], [field]: value };
    updateField('performance_videos', videos);
  };

  const removeVideo = (index: number) => {
    const videos = formData.performance_videos?.filter((_, i) => i !== index) || [];
    updateField('performance_videos', videos);
  };

  const addAchievement = () => {
    const newAchievement: Achievement = {
      id: Date.now().toString(),
      title: '',
      description: '',
      year: '',
      image_url: '',
    };
    updateField('achievements', [...(formData.achievements || []), newAchievement]);
  };

  const updateAchievement = (index: number, field: keyof Achievement, value: string) => {
    const achievements = [...(formData.achievements || [])];
    achievements[index] = { ...achievements[index], [field]: value };
    updateField('achievements', achievements);
  };

  const removeAchievement = (index: number) => {
    const achievements = formData.achievements?.filter((_, i) => i !== index) || [];
    updateField('achievements', achievements);
  };

  const addExperience = () => {
    const newExp: Experience = {
      id: Date.now().toString(),
      event_name: '',
      event_type: '',
      date: '',
      location: '',
      description: '',
    };
    updateField('experience', [...(formData.experience || []), newExp]);
  };

  const updateExperience = (index: number, field: keyof Experience, value: string) => {
    const experience = [...(formData.experience || [])];
    experience[index] = { ...experience[index], [field]: value };
    updateField('experience', experience);
  };

  const removeExperience = (index: number) => {
    const experience = formData.experience?.filter((_, i) => i !== index) || [];
    updateField('experience', experience);
  };

  const addArrayItem = (field: 'specialties' | 'genres' | 'languages' | 'notable_events', value: string) => {
    if (!value.trim()) return;
    const current = formData[field] || [];
    updateField(field, [...current, value.trim()]);
  };

  const removeArrayItem = (field: 'specialties' | 'genres' | 'languages' | 'notable_events', index: number) => {
    const current = formData[field] || [];
    updateField(field, current.filter((_, i) => i !== index));
  };

  const [uploadingStates, setUploadingStates] = useState<Record<string, boolean>>({});

  const uploadImage = async (type: 'team_member' | 'achievement' | 'video_thumbnail', index?: number): Promise<string> => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your photo library');
        return '';
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return '';
      }

      const asset = result.assets[0];
      const uploadKey = `${type}_${index ?? 'single'}`;
      setUploadingStates(prev => ({ ...prev, [uploadKey]: true }));

      try {
        let file: File | { uri: string; name?: string; type?: string };
        
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
          const filename = `upload_${Date.now()}.${ext}`;
          file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        } else {
          const ext = asset.uri.split('.').pop()?.split('?')[0] || 'jpg';
          const filename = `upload_${Date.now()}.${ext}`;
          file = {
            uri: asset.uri,
            name: filename,
            type: `image/${ext}`,
          };
        }

        const uploadResult = await UploadAPI.uploadImage(file);
        return uploadResult.url;
      } finally {
        setUploadingStates(prev => {
          const newState = { ...prev };
          delete newState[uploadKey];
          return newState;
        });
      }
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Failed to upload image');
      return '';
    }
  };

  const uploadVideo = async (index?: number): Promise<string> => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow access to your media library');
        return '';
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) {
        return '';
      }

      const asset = result.assets[0];
      const uploadKey = `video_${index ?? 'single'}`;
      setUploadingStates(prev => ({ ...prev, [uploadKey]: true }));

      try {
        let file: File | { uri: string; name?: string; type?: string };
        
        if (Platform.OS === 'web') {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          const ext = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
          const filename = `upload_${Date.now()}.${ext}`;
          file = new File([blob], filename, { type: blob.type || 'video/mp4' });
        } else {
          const ext = asset.uri.split('.').pop()?.split('?')[0] || 'mp4';
          const filename = `upload_${Date.now()}.${ext}`;
          file = {
            uri: asset.uri,
            name: filename,
            type: `video/${ext}`,
          };
        }

        const uploadResult = await UploadAPI.uploadVideo(file);
        return uploadResult.url;
      } finally {
        setUploadingStates(prev => {
          const newState = { ...prev };
          delete newState[uploadKey];
          return newState;
        });
      }
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Failed to upload video');
      return '';
    }
  };

  // Validation function - only important fields are required
  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Team name is required
    if (!formData.team_name || !formData.team_name.trim()) {
      errors.team_name = 'Team name is required';
    }
    
    // Detailed bio is required
    if (!formData.detailed_bio || !formData.detailed_bio.trim()) {
      errors.detailed_bio = 'Detailed bio is required';
    }
    
    setValidationErrors(errors);
    if (onValidationError) {
      onValidationError(errors);
    }
    
    return Object.keys(errors).length === 0;
  };

  // Scroll to first error field
  const scrollToError = () => {
    setTimeout(() => {
      if (validationErrors.team_name && teamNameViewRef.current && scrollViewRef.current) {
        teamNameViewRef.current.measure((fx, fy, width, height, px, py) => {
          const scrollY = Math.max(0, py - 100);
          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
        });
      } else if (validationErrors.detailed_bio && detailedBioViewRef.current && scrollViewRef.current) {
        detailedBioViewRef.current.measure((fx, fy, width, height, px, py) => {
          const scrollY = Math.max(0, py - 100);
          scrollViewRef.current?.scrollTo({ y: scrollY, animated: true });
        });
      }
    }, 150);
  };

  // Expose validate and scrollToError functions via ref
  useImperativeHandle(ref, () => ({
    validate,
    scrollToError,
  }));

  // Clear validation error when field is updated
  const updateFieldWithValidation = (field: keyof PerformanceTeamProfile, value: any) => {
    if (validationErrors[field as string]) {
      const newErrors = { ...validationErrors };
      delete newErrors[field as string];
      setValidationErrors(newErrors);
    }
    updateField(field, value);
  };

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} nestedScrollEnabled>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Basic Information</ThemedText>
        
        <View ref={teamNameViewRef} style={styles.inputGroup}>
          <Text style={styles.label}>Team Name <Text style={styles.required}>*</Text></Text>
          <TextInput
            ref={teamNameRef}
            style={[styles.input, validationErrors.team_name && styles.inputError]}
            value={formData.team_name || ''}
            onChangeText={(v) => updateFieldWithValidation('team_name', v)}
            placeholder="Enter team name"
          />
          {validationErrors.team_name && (
            <Text style={styles.errorText}>{validationErrors.team_name}</Text>
          )}
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Established Year</Text>
            <TextInput
              style={styles.input}
              value={formData.established_year || ''}
              onChangeText={(v) => updateField('established_year', v)}
              placeholder="e.g., 2010"
              keyboardType="numeric"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Total Experience</Text>
            <TextInput
              style={styles.input}
              value={formData.total_experience || ''}
              onChangeText={(v) => updateField('total_experience', v)}
              placeholder="e.g., 10 years"
            />
          </View>
        </View>

        <View ref={detailedBioViewRef} style={styles.inputGroup}>
          <Text style={styles.label}>Detailed Bio <Text style={styles.required}>*</Text></Text>
          <TextInput
            ref={detailedBioRef}
            style={[styles.input, styles.textArea, validationErrors.detailed_bio && styles.inputError]}
            value={formData.detailed_bio || ''}
            onChangeText={(v) => updateFieldWithValidation('detailed_bio', v)}
            placeholder="Tell the story of your team..."
            multiline
            numberOfLines={6}
          />
          {validationErrors.detailed_bio && (
            <Text style={styles.errorText}>{validationErrors.detailed_bio}</Text>
          )}
        </View>
      </View>

      {/* Specialties & Genres */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Specialties & Genres</ThemedText>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Specialties</Text>
          <View style={styles.tagContainer}>
            {(formData.specialties || []).map((item, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
                <TouchableOpacity onPress={() => removeArrayItem('specialties', idx)}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Type and press Enter to add"
            onSubmitEditing={(e) => {
              addArrayItem('specialties', e.nativeEvent.text);
              e.currentTarget.clear();
            }}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Genres</Text>
          <View style={styles.tagContainer}>
            {(formData.genres || []).map((item, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
                <TouchableOpacity onPress={() => removeArrayItem('genres', idx)}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Type and press Enter to add"
            onSubmitEditing={(e) => {
              addArrayItem('genres', e.nativeEvent.text);
              e.currentTarget.clear();
            }}
          />
        </View>
      </View>

      {/* Team Members */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Team Members</ThemedText>
          <TouchableOpacity onPress={addTeamMember} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color="#2563EB" />
            <Text style={styles.addButtonText}>Add Member</Text>
          </TouchableOpacity>
        </View>

        {(formData.team_members || []).map((member, idx) => (
          <View key={member.id || idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Member {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeTeamMember(idx)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={member.name}
              onChangeText={(v) => updateTeamMember(idx, 'name', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Role (e.g., Lead Vocalist, Drummer)"
              value={member.role}
              onChangeText={(v) => updateTeamMember(idx, 'role', v)}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Bio"
              value={member.bio}
              onChangeText={(v) => updateTeamMember(idx, 'bio', v)}
              multiline
              numberOfLines={3}
            />
            <View style={styles.uploadRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Photo URL or upload image"
                value={member.photo_url || ''}
                onChangeText={(v) => updateTeamMember(idx, 'photo_url', v)}
              />
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  const url = await uploadImage('team_member', idx);
                  if (url) {
                    updateTeamMember(idx, 'photo_url', url);
                  }
                }}
                disabled={uploadingStates[`team_member_${idx}`]}
              >
                {uploadingStates[`team_member_${idx}`] ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>
            </View>
            {member.photo_url && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: member.photo_url }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => updateTeamMember(idx, 'photo_url', '')}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Performance Videos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Performance Videos</ThemedText>
          <TouchableOpacity onPress={addVideo} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color="#2563EB" />
            <Text style={styles.addButtonText}>Add Video</Text>
          </TouchableOpacity>
        </View>

        {(formData.performance_videos || []).map((video, idx) => (
          <View key={video.id || idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Video {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeVideo(idx)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Video Title"
              value={video.title}
              onChangeText={(v) => updateVideo(idx, 'title', v)}
            />
            <View style={styles.uploadRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Video URL (YouTube, Vimeo, etc.) or upload video file"
                value={video.url}
                onChangeText={(v) => updateVideo(idx, 'url', v)}
              />
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  const url = await uploadVideo(idx);
                  if (url) {
                    updateVideo(idx, 'url', url);
                  }
                }}
                disabled={uploadingStates[`video_${idx}`]}
              >
                {uploadingStates[`video_${idx}`] ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="videocam" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.uploadRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Thumbnail URL (optional) or upload thumbnail"
                value={video.thumbnail_url || ''}
                onChangeText={(v) => updateVideo(idx, 'thumbnail_url', v)}
              />
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  const url = await uploadImage('video_thumbnail', idx);
                  if (url) {
                    updateVideo(idx, 'thumbnail_url', url);
                  }
                }}
                disabled={uploadingStates[`video_thumbnail_${idx}`]}
              >
                {uploadingStates[`video_thumbnail_${idx}`] ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="image-outline" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>
            </View>
            {video.thumbnail_url && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: video.thumbnail_url }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => updateVideo(idx, 'thumbnail_url', '')}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Experience & History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Experience & History</ThemedText>
          <TouchableOpacity onPress={addExperience} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color="#2563EB" />
            <Text style={styles.addButtonText}>Add Experience</Text>
          </TouchableOpacity>
        </View>

        {(formData.experience || []).map((exp, idx) => (
          <View key={exp.id || idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Experience {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeExperience(idx)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Event Name"
              value={exp.event_name}
              onChangeText={(v) => updateExperience(idx, 'event_name', v)}
            />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <TextInput
                  style={styles.input}
                  placeholder="Event Type"
                  value={exp.event_type}
                  onChangeText={(v) => updateExperience(idx, 'event_type', v)}
                />
              </View>
              <View style={styles.halfWidth}>
                <TextInput
                  style={styles.input}
                  placeholder="Date"
                  value={exp.date}
                  onChangeText={(v) => updateExperience(idx, 'date', v)}
                />
              </View>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Location"
              value={exp.location}
              onChangeText={(v) => updateExperience(idx, 'location', v)}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={exp.description}
              onChangeText={(v) => updateExperience(idx, 'description', v)}
              multiline
              numberOfLines={3}
            />
          </View>
        ))}
      </View>

      {/* Achievements & Awards */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Achievements & Awards</ThemedText>
          <TouchableOpacity onPress={addAchievement} style={styles.addButton}>
            <Ionicons name="add-circle" size={24} color="#2563EB" />
            <Text style={styles.addButtonText}>Add Achievement</Text>
          </TouchableOpacity>
        </View>

        {(formData.achievements || []).map((achievement, idx) => (
          <View key={achievement.id || idx} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Achievement {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeAchievement(idx)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Achievement Title"
              value={achievement.title}
              onChangeText={(v) => updateAchievement(idx, 'title', v)}
            />
            <TextInput
              style={styles.input}
              placeholder="Year (optional)"
              value={achievement.year || ''}
              onChangeText={(v) => updateAchievement(idx, 'year', v)}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={achievement.description}
              onChangeText={(v) => updateAchievement(idx, 'description', v)}
              multiline
              numberOfLines={3}
            />
            <View style={styles.uploadRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Image URL (optional) or upload image"
                value={achievement.image_url || ''}
                onChangeText={(v) => updateAchievement(idx, 'image_url', v)}
              />
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={async () => {
                  const url = await uploadImage('achievement', idx);
                  if (url) {
                    updateAchievement(idx, 'image_url', url);
                  }
                }}
                disabled={uploadingStates[`achievement_${idx}`]}
              >
                {uploadingStates[`achievement_${idx}`] ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={20} color="#2563EB" />
                )}
              </TouchableOpacity>
            </View>
            {achievement.image_url && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: achievement.image_url }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => updateAchievement(idx, 'image_url', '')}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Contact & Social Media */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Contact & Social Media</ThemedText>
        
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Contact Email</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_email || ''}
              onChangeText={(v) => updateField('contact_email', v)}
              placeholder="team@example.com"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.contact_phone || ''}
              onChangeText={(v) => updateField('contact_phone', v)}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            value={formData.website || ''}
            onChangeText={(v) => updateField('website', v)}
            placeholder="https://..."
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Facebook</Text>
          <TextInput
            style={styles.input}
            value={formData.social_media?.facebook || ''}
            onChangeText={(v) => updateField('social_media', { ...formData.social_media, facebook: v })}
            placeholder="Facebook page URL"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Instagram</Text>
          <TextInput
            style={styles.input}
            value={formData.social_media?.instagram || ''}
            onChangeText={(v) => updateField('social_media', { ...formData.social_media, instagram: v })}
            placeholder="Instagram profile URL"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>YouTube</Text>
          <TextInput
            style={styles.input}
            value={formData.social_media?.youtube || ''}
            onChangeText={(v) => updateField('social_media', { ...formData.social_media, youtube: v })}
            placeholder="YouTube channel URL"
          />
        </View>
      </View>

      {/* Additional Info */}
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Additional Information</ThemedText>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Languages</Text>
          <View style={styles.tagContainer}>
            {(formData.languages || []).map((item, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
                <TouchableOpacity onPress={() => removeArrayItem('languages', idx)}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Type and press Enter to add"
            onSubmitEditing={(e) => {
              addArrayItem('languages', e.nativeEvent.text);
              e.currentTarget.clear();
            }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Performance Duration</Text>
            <TextInput
              style={styles.input}
              value={formData.performance_duration || ''}
              onChangeText={(v) => updateField('performance_duration', v)}
              placeholder="e.g., 60-90 minutes"
            />
          </View>
          <View style={styles.halfWidth}>
            <Text style={styles.label}>Setup Time</Text>
            <TextInput
              style={styles.input}
              value={formData.setup_time || ''}
              onChangeText={(v) => updateField('setup_time', v)}
              placeholder="e.g., 30 minutes"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Requirements</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.requirements || ''}
            onChangeText={(v) => updateField('requirements', v)}
            placeholder="Stage requirements, sound system, etc."
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notable Events</Text>
          <View style={styles.tagContainer}>
            {(formData.notable_events || []).map((item, idx) => (
              <View key={idx} style={styles.tag}>
                <Text style={styles.tagText}>{item}</Text>
                <TouchableOpacity onPress={() => removeArrayItem('notable_events', idx)}>
                  <Ionicons name="close-circle" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Type and press Enter to add"
            onSubmitEditing={(e) => {
              addArrayItem('notable_events', e.nativeEvent.text);
              e.currentTarget.clear();
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  tagText: {
    fontSize: 13,
    color: '#374151',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  required: {
    color: '#EF4444',
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 4,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  imagePreview: {
    marginTop: 8,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
});

export default PerformanceTeamProfileForm;

