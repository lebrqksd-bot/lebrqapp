/**
 * Public Contest Page
 * Displays contest details and entry form at /contest/[slug]
 */
import { CONFIG } from '@/constants/config';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

interface Contest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  hero_image_url: string | null;
  banner_image_url: string | null;
  start_date: string;
  end_date: string;
  applicable_event_types: string[] | null;
  prizes: Array<{ title: string; qty: number; details: string | null }> | null;
  eligibility_criteria: string | null;
  per_user_limit: number;
}

interface FileUpload {
  uri: string;
  name: string;
  type: string;
  size: number;
  fileObj?: File; // Store File object for web
}

export default function ContestPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form state
  const [participantName, setParticipantName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState('birthday');
  const [eventDate, setEventDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const [relation, setRelation] = useState('self');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<FileUpload[]>([]);
  
  // Family member event dates state
  const [familyEventDates, setFamilyEventDates] = useState<Array<{
    id?: number;
    person_name: string;
    event_type: string;
    event_date: string;
    relation: string;
  }>>([]);
  const [showAddFamilyDate, setShowAddFamilyDate] = useState(false);
  const [newFamilyDate, setNewFamilyDate] = useState({
    person_name: '',
    event_type: 'birthday',
    event_date: '',
    relation: 'family',
  });
  const [showFamilyDatePicker, setShowFamilyDatePicker] = useState(false);
  const [familyDatePickerValue, setFamilyDatePickerValue] = useState(new Date());
  const [editingFamilyDateIndex, setEditingFamilyDateIndex] = useState<number | null>(null);

  useEffect(() => {
    loadContest();
  }, [slug]);

  const loadContest = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/contests/${slug}`);
      if (!res.ok) {
        throw new Error('Contest not found');
      }
      const data = await res.json();
      setContest(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contest');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    try {
      if (Platform.OS === 'web') {
        // For web: use HTML file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf';
        input.onchange = (e: any) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            setFiles([
              ...files,
              {
                uri: URL.createObjectURL(selectedFile),
                name: selectedFile.name,
                type: selectedFile.type,
                size: selectedFile.size,
              },
            ]);
          }
        };
        input.click();
      } else {
        // For native: use DocumentPicker
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setFiles([
            ...files,
            {
              uri: asset.uri,
              name: asset.name || 'file',
              type: asset.mimeType || 'application/octet-stream',
              size: asset.size || 0,
            },
          ]);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const pickImage = async () => {
    try {
      if (Platform.OS === 'web') {
        // For web: use HTML file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) {
            setFiles([
              ...files,
              {
                uri: URL.createObjectURL(selectedFile),
                name: selectedFile.name,
                type: selectedFile.type,
                size: selectedFile.size,
                fileObj: selectedFile, // Store the File object for direct use
              },
            ]);
          }
        };
        input.click();
      } else {
        // For native: use ImagePicker
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setFiles([
            ...files,
            {
              uri: asset.uri,
              name: `image_${Date.now()}.jpg`,
              type: 'image/jpeg',
              size: 0,
            },
          ]);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    // On Android, the picker closes automatically, so we need to handle it differently
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      // On Android, if user cancels, event.type will be 'dismissed'
      if (event.type === 'dismissed') {
        return;
      }
    }
    
    if (selectedDate) {
      setDatePickerValue(selectedDate);
      // Format date as YYYY-MM-DD
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setEventDate(`${year}-${month}-${day}`);
    }
  };

  const uploadFiles = async (): Promise<Array<{ url: string; name: string; type: string; size: number }>> => {
    const uploadedFiles = [];
    
    for (const file of files) {
      try {
        const formData = new FormData();
        
        // Handle web vs native differently
        if (Platform.OS === 'web') {
          // For web: use stored File object if available, otherwise fetch from blob URL
          let fileObj: File;
          
          try {
            if (file.fileObj) {
              // Use stored File object directly (most reliable)
              fileObj = file.fileObj;
            } else if (file.uri.startsWith('blob:')) {
              // Blob URL - fetch it and convert to File
              const response = await fetch(file.uri);
              if (!response.ok) {
                throw new Error(`Failed to fetch blob: ${response.status}`);
              }
              const blob = await response.blob();
              fileObj = new File([blob], file.name, { type: file.type || blob.type });
            } else if (file.uri.startsWith('data:')) {
              // Data URL - convert to blob then File
              const response = await fetch(file.uri);
              const blob = await response.blob();
              fileObj = new File([blob], file.name, { type: file.type || blob.type });
            } else {
              // Try to fetch from URL
              const response = await fetch(file.uri);
              if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status}`);
              }
              const blob = await response.blob();
              fileObj = new File([blob], file.name, { type: file.type || blob.type });
            }
            
            formData.append('file', fileObj);
          } catch (error: any) {
            console.error('File conversion error:', error);
            throw new Error(`Failed to prepare file for upload: ${error.message}`);
          }
        } else {
          // For React Native: use the object format
          formData.append('file', {
            uri: file.uri,
            name: file.name,
            type: file.type,
          } as any);
        }

        // Upload file - don't set Content-Type, let fetch set it automatically with boundary
        const res = await fetch(`${API_BASE}/contests/${slug}/upload-proof`, {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - FormData will set it with boundary
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.detail || 'Failed to upload file');
        }

        const result = await res.json();
        uploadedFiles.push({
          url: result.url,
          name: result.filename,
          type: result.file_type,
          size: result.file_size,
        });
      } catch (error: any) {
        console.error('File upload error:', error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    
    return uploadedFiles;
  };

  const handleSubmit = async () => {
    if (!participantName.trim()) {
      Alert.alert('Error', 'Please enter participant name');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Error', 'Please enter email or phone');
      return;
    }
    if (!eventDate) {
      Alert.alert('Error', 'Please select event date');
      return;
    }
    if (!consent) {
      Alert.alert('Error', 'Please accept terms and conditions');
      return;
    }

    try {
      setSubmitting(true);

      // Upload files
      const uploadedFiles = await uploadFiles();

      const entryData = {
        participant_name: participantName,
        email: email || null,
        phone: phone || null,
        event_type: eventType,
        event_date: eventDate,
        relation,
        message: message || null,
        consent: true,
        file_urls: uploadedFiles.map((f) => `${API_BASE.replace('/api', '')}${f.url}`),
        file_names: uploadedFiles.map((f) => f.name),
        file_types: uploadedFiles.map((f) => f.type),
        file_sizes: uploadedFiles.map((f) => f.size),
      };

      const res = await fetch(`${API_BASE}/contests/${slug}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entryData),
      });

      if (!res.ok) {
        const error = await res.json();
        const errorMessage = error.message || error.detail || 'Failed to submit entry';
        throw new Error(errorMessage);
      }

      const result = await res.json();
      
      // Save family member event dates if any
      if (familyEventDates.length > 0 && (email || phone)) {
        try {
          for (const fd of familyEventDates) {
            await fetch(`${API_BASE}/contests/user-event-dates`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                person_name: fd.person_name,
                event_type: fd.event_type,
                event_date: fd.event_date,
                relation: fd.relation,
                email: email || null,
                phone: phone || null,
                notify_on_offers: true,
              }),
            });
          }
        } catch (error) {
          console.error('Failed to save family event dates:', error);
          // Don't fail the whole submission if family dates fail
        }
      }
      
      // Show success modal
      const successMsg = `Entry submitted successfully!${result.reference_id ? `\n\nReference ID: ${result.reference_id}` : ''}${familyEventDates.length > 0 ? '\n\nFamily member dates saved. We\'ll notify you about special offers!' : ''}`;
      setSuccessMessage(successMsg);
      setShowSuccessModal(true);
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to submit entry';
      Alert.alert(
        'Notice',
        errorMessage,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Loading Contest - LeBrq</title>
        </Head>
        <View style={styles.container}>
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!contest) {
    return (
      <>
        <Head>
          <title>Contest Not Found - LeBrq</title>
        </Head>
        <View style={styles.container}>
          <Text style={styles.errorText}>Contest not found</Text>
        </View>
      </>
    );
  }

  // Construct full URL for banner image if it's relative
  const bannerImageUrl = contest.banner_image_url?.startsWith('http')
    ? contest.banner_image_url
    : contest.banner_image_url
    ? `${API_BASE.replace('/api', '')}${contest.banner_image_url}`
    : null;

  return (
    <>
    <Head>
      <title>{contest ? `${contest.title} - Contest` : 'Contest - LeBrq'}</title>
    </Head>
    {bannerImageUrl ? (
      <ImageBackground
        source={{ uri: bannerImageUrl }}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.7)']}
          locations={[0, 0.5, 1]}
          style={styles.overlay}
        >
          <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            {/* Hero Image */}
            {contest.hero_image_url && (
              <Image
                source={{ 
                  uri: contest.hero_image_url.startsWith('http')
                    ? contest.hero_image_url
                    : `${API_BASE.replace('/api', '')}${contest.hero_image_url}`
                }}
                style={styles.heroImage}
                contentFit="contain"
              />
            )}

            <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{contest.title}</Text>

        {/* Description */}
        {contest.description && (
          <Text style={styles.description}>{contest.description}</Text>
        )}

        {/* Prizes */}
        {contest.prizes && contest.prizes.length > 0 && (
          <View style={styles.prizesSection}>
            <Text style={styles.sectionTitle}>Prizes</Text>
            {contest.prizes.map((prize, index) => (
              <View key={index} style={styles.prizeItem}>
                <Text style={styles.prizeTitle}>{prize.title}</Text>
                {prize.details && (
                  <Text style={styles.prizeDetails}>{prize.details}</Text>
                )}
                <Text style={styles.prizeQty}>Quantity: {prize.qty}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Eligibility */}
        {contest.eligibility_criteria && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eligibility</Text>
            <Text style={styles.text}>{contest.eligibility_criteria}</Text>
          </View>
        )}

        {/* Entry Form */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Submit Your Entry</Text>

          <TextInput
            style={styles.input}
            placeholder="Participant Name *"
            value={participantName}
            onChangeText={setParticipantName}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <View style={styles.row}>
            <Text style={styles.label}>Event Type:</Text>
            <View style={styles.radioGroup}>
              {['birthday', 'anniversary', 'other'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.radio}
                  onPress={() => setEventType(type)}
                >
                  <Ionicons
                    name={eventType === type ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color="#007AFF"
                  />
                  <Text style={styles.radioLabel}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.dateInputContainer}>
            <Text style={styles.label}>
              {eventType === 'birthday' ? 'Birthday Date *' : 
               eventType === 'anniversary' ? 'Anniversary Date *' : 
               'Event Date *'}
            </Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid #DDD',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => {
                    console.log('Date picker button pressed, setting showDatePicker to true');
                    setShowDatePicker(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateInputText, !eventDate && styles.dateInputPlaceholder]}>
                    {eventDate || `Select ${eventType === 'birthday' ? 'birthday' : eventType === 'anniversary' ? 'anniversary' : 'event'} date`}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
                {showDatePicker && Platform.OS === 'ios' && (
                  <>
                    <View style={styles.iosPickerHeader}>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.iosPickerButton}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={datePickerValue}
                      mode="date"
                      display="spinner"
                      onChange={handleDatePickerChange}
                      textColor="#000000"
                    />
                  </>
                )}
              </>
            )}
          </View>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Message (optional)"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
          />

          {/* Family Member Event Dates Section */}
          <View style={styles.familyDatesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add Family Member Event Dates</Text>
              <Text style={styles.sectionSubtitle}>
                We'll notify you about special offers for birthdays & anniversaries
              </Text>
            </View>

            {familyEventDates.map((fd, index) => (
              <View key={index} style={styles.familyDateCard}>
                <View style={styles.familyDateInfo}>
                  <Text style={styles.familyDateName}>{fd.person_name}</Text>
                  <Text style={styles.familyDateDetails}>
                    {fd.event_type} • {fd.relation} • {new Date(fd.event_date).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setNewFamilyDate(fd);
                    setEditingFamilyDateIndex(index);
                    setShowAddFamilyDate(true);
                  }}
                  style={styles.editButton}
                >
                  <Ionicons name="pencil" size={18} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setFamilyEventDates(familyEventDates.filter((_, i) => i !== index));
                  }}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}

            {showAddFamilyDate ? (
              <View style={styles.addFamilyDateForm}>
                <Text style={styles.label}>Person Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., John Doe"
                  value={newFamilyDate.person_name}
                  onChangeText={(text) => setNewFamilyDate({ ...newFamilyDate, person_name: text })}
                />

                <Text style={styles.label}>Event Type *</Text>
                <View style={styles.radioGroup}>
                  {['birthday', 'anniversary', 'other'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.radio}
                      onPress={() => setNewFamilyDate({ ...newFamilyDate, event_type: type })}
                    >
                      <Ionicons
                        name={newFamilyDate.event_type === type ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color="#007AFF"
                      />
                      <Text style={styles.radioLabel}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>
                  {newFamilyDate.event_type === 'birthday' ? 'Birthday Date *' : 
                   newFamilyDate.event_type === 'anniversary' ? 'Anniversary Date *' : 
                   'Event Date *'}
                </Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={newFamilyDate.event_date}
                    onChange={(e) => setNewFamilyDate({ ...newFamilyDate, event_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '16px',
                      border: '1px solid #DDD',
                      borderRadius: '8px',
                      marginBottom: '12px',
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowFamilyDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dateInputText, !newFamilyDate.event_date && styles.dateInputPlaceholder]}>
                        {newFamilyDate.event_date ? new Date(newFamilyDate.event_date).toLocaleDateString() : `Select ${newFamilyDate.event_type === 'birthday' ? 'birthday' : newFamilyDate.event_type === 'anniversary' ? 'anniversary' : 'event'} date`}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                    {showFamilyDatePicker && Platform.OS === 'ios' && (
                      <>
                        <View style={styles.iosPickerHeader}>
                          <TouchableOpacity onPress={() => setShowFamilyDatePicker(false)}>
                            <Text style={styles.iosPickerButton}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setShowFamilyDatePicker(false)}>
                            <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={familyDatePickerValue}
                          mode="date"
                          display="spinner"
                          onChange={(event, selectedDate) => {
                            if (selectedDate) {
                              setFamilyDatePickerValue(selectedDate);
                              const year = selectedDate.getFullYear();
                              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                              const day = String(selectedDate.getDate()).padStart(2, '0');
                              setNewFamilyDate({ ...newFamilyDate, event_date: `${year}-${month}-${day}` });
                            }
                          }}
                          textColor="#000000"
                        />
                      </>
                    )}
                  </>
                )}

                <Text style={styles.label}>Relation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., family, friend, spouse"
                  value={newFamilyDate.relation}
                  onChangeText={(text) => setNewFamilyDate({ ...newFamilyDate, relation: text })}
                />

                <View style={styles.familyDateFormActions}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => {
                      setShowAddFamilyDate(false);
                      setNewFamilyDate({ person_name: '', event_type: 'birthday', event_date: '', relation: 'family' });
                      setEditingFamilyDateIndex(null);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.saveButton]}
                    onPress={() => {
                      if (!newFamilyDate.person_name || !newFamilyDate.event_date) {
                        Alert.alert('Error', 'Please fill in person name and event date');
                        return;
                      }
                      if (editingFamilyDateIndex !== null) {
                        const updated = [...familyEventDates];
                        updated[editingFamilyDateIndex] = newFamilyDate;
                        setFamilyEventDates(updated);
                      } else {
                        setFamilyEventDates([...familyEventDates, newFamilyDate]);
                      }
                      setShowAddFamilyDate(false);
                      setNewFamilyDate({ person_name: '', event_type: 'birthday', event_date: '', relation: 'family' });
                      setEditingFamilyDateIndex(null);
                    }}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addFamilyDateButton}
                onPress={() => setShowAddFamilyDate(true)}
              >
                <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                <Text style={styles.addFamilyDateButtonText}>Add Family Member Date</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* File Upload */}
          <View style={styles.fileSection}>
            <Text style={styles.label}>Upload Proof (Image/PDF)</Text>
            <View style={styles.fileButtons}>
              <TouchableOpacity style={styles.fileButton} onPress={pickImage}>
                <Ionicons name="image-outline" size={20} color="#007AFF" />
                <Text style={styles.fileButtonText}>Pick Image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
                <Ionicons name="document-outline" size={20} color="#007AFF" />
                <Text style={styles.fileButtonText}>Pick File</Text>
              </TouchableOpacity>
            </View>

            {files.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <Text style={styles.fileName}>{file.name}</Text>
                <TouchableOpacity onPress={() => removeFile(index)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Consent */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setConsent(!consent)}
          >
            <Ionicons
              name={consent ? 'checkbox' : 'square-outline'}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.checkboxLabel}>
              I accept the terms and conditions and consent to receive messages
            </Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
              {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Entry</Text>
            )}
          </TouchableOpacity>
        </View>
        </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    ) : (
      <ScrollView style={styles.container}>
        {/* Hero Image */}
        {contest.hero_image_url && (
          <Image
            source={{ 
              uri: contest.hero_image_url.startsWith('http')
                ? contest.hero_image_url
                : `${API_BASE.replace('/api', '')}${contest.hero_image_url}`
            }}
            style={styles.heroImage}
            contentFit="contain"
          />
        )}

        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.title}>{contest.title}</Text>

          {/* Description */}
          {contest.description && (
            <Text style={styles.description}>{contest.description}</Text>
          )}

          {/* Prizes */}
          {contest.prizes && contest.prizes.length > 0 && (
            <View style={styles.prizesSection}>
              <Text style={styles.sectionTitle}>Prizes</Text>
              {contest.prizes.map((prize, index) => (
                <View key={index} style={styles.prizeItem}>
                  <Text style={styles.prizeTitle}>{prize.title}</Text>
                  {prize.details && (
                    <Text style={styles.prizeDetails}>{prize.details}</Text>
                  )}
                  <Text style={styles.prizeQty}>Quantity: {prize.qty}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Eligibility */}
          {contest.eligibility_criteria && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Eligibility</Text>
              <Text style={styles.text}>{contest.eligibility_criteria}</Text>
            </View>
          )}

          {/* Entry Form */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Submit Your Entry</Text>

            <TextInput
              style={styles.input}
              placeholder="Participant Name *"
              value={participantName}
              onChangeText={setParticipantName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.row}>
              <Text style={styles.label}>Event Type:</Text>
              <View style={styles.radioGroup}>
                {['birthday', 'anniversary', 'other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.radio}
                    onPress={() => setEventType(type)}
                  >
                    <Ionicons
                      name={eventType === type ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color="#007AFF"
                    />
                    <Text style={styles.radioLabel}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.dateInputContainer}>
              <Text style={styles.label}>
                {eventType === 'birthday' ? 'Birthday Date *' : 
                 eventType === 'anniversary' ? 'Anniversary Date *' : 
                 'Event Date *'}
              </Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '16px',
                    border: '1px solid #DDD',
                    borderRadius: '8px',
                    marginBottom: '12px',
                  }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => {
                      console.log('Date picker button pressed, setting showDatePicker to true');
                      setShowDatePicker(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dateInputText, !eventDate && styles.dateInputPlaceholder]}>
                      {eventDate || `Select ${eventType === 'birthday' ? 'birthday' : eventType === 'anniversary' ? 'anniversary' : 'event'} date`}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {showDatePicker && Platform.OS === 'ios' && (
                    <>
                      <View style={styles.iosPickerHeader}>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Text style={styles.iosPickerButton}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={datePickerValue}
                        mode="date"
                        display="spinner"
                        onChange={handleDatePickerChange}
                        textColor="#000000"
                      />
                    </>
                  )}
                </>
              )}
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Message (optional)"
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
            />

            {/* Family Member Event Dates Section */}
            <View style={styles.familyDatesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Add Family Member Event Dates</Text>
                <Text style={styles.sectionSubtitle}>
                  We'll notify you about special offers for birthdays & anniversaries
                </Text>
              </View>

              {familyEventDates.map((fd, index) => (
                <View key={index} style={styles.familyDateCard}>
                  <View style={styles.familyDateInfo}>
                    <Text style={styles.familyDateName}>{fd.person_name}</Text>
                    <Text style={styles.familyDateDetails}>
                      {fd.event_type} • {fd.relation} • {new Date(fd.event_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setNewFamilyDate(fd);
                      setEditingFamilyDateIndex(index);
                      setShowAddFamilyDate(true);
                    }}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={18} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setFamilyEventDates(familyEventDates.filter((_, i) => i !== index));
                    }}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}

              {showAddFamilyDate ? (
                <View style={styles.addFamilyDateForm}>
                  <Text style={styles.label}>Person Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., John Doe"
                    value={newFamilyDate.person_name}
                    onChangeText={(text) => setNewFamilyDate({ ...newFamilyDate, person_name: text })}
                  />

                  <Text style={styles.label}>Event Type *</Text>
                  <View style={styles.radioGroup}>
                    {['birthday', 'anniversary', 'other'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.radio}
                        onPress={() => setNewFamilyDate({ ...newFamilyDate, event_type: type })}
                      >
                        <Ionicons
                          name={newFamilyDate.event_type === type ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color="#007AFF"
                        />
                        <Text style={styles.radioLabel}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>
                    {newFamilyDate.event_type === 'birthday' ? 'Birthday Date *' : 
                     newFamilyDate.event_type === 'anniversary' ? 'Anniversary Date *' : 
                     'Event Date *'}
                  </Text>
                  {Platform.OS === 'web' ? (
                    <input
                      type="date"
                      value={newFamilyDate.event_date}
                      onChange={(e) => setNewFamilyDate({ ...newFamilyDate, event_date: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '16px',
                        border: '1px solid #DDD',
                        borderRadius: '8px',
                        marginBottom: '12px',
                      }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateInput}
                        onPress={() => setShowFamilyDatePicker(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dateInputText, !newFamilyDate.event_date && styles.dateInputPlaceholder]}>
                          {newFamilyDate.event_date ? new Date(newFamilyDate.event_date).toLocaleDateString() : `Select ${newFamilyDate.event_type === 'birthday' ? 'birthday' : newFamilyDate.event_type === 'anniversary' ? 'anniversary' : 'event'} date`}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                      </TouchableOpacity>
                      {showFamilyDatePicker && Platform.OS === 'ios' && (
                        <>
                          <View style={styles.iosPickerHeader}>
                            <TouchableOpacity onPress={() => setShowFamilyDatePicker(false)}>
                              <Text style={styles.iosPickerButton}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowFamilyDatePicker(false)}>
                              <Text style={[styles.iosPickerButton, styles.iosPickerButtonPrimary]}>Done</Text>
                            </TouchableOpacity>
                          </View>
                          <DateTimePicker
                            value={familyDatePickerValue}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setFamilyDatePickerValue(selectedDate);
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                                const day = String(selectedDate.getDate()).padStart(2, '0');
                                setNewFamilyDate({ ...newFamilyDate, event_date: `${year}-${month}-${day}` });
                              }
                            }}
                            textColor="#000000"
                          />
                        </>
                      )}
                    </>
                  )}

                  <Text style={styles.label}>Relation</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., family, friend, spouse"
                    value={newFamilyDate.relation}
                    onChangeText={(text) => setNewFamilyDate({ ...newFamilyDate, relation: text })}
                  />

                  <View style={styles.familyDateFormActions}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setShowAddFamilyDate(false);
                        setNewFamilyDate({ person_name: '', event_type: 'birthday', event_date: '', relation: 'family' });
                        setEditingFamilyDateIndex(null);
                      }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.saveButton]}
                      onPress={() => {
                        if (!newFamilyDate.person_name || !newFamilyDate.event_date) {
                          Alert.alert('Error', 'Please fill in person name and event date');
                          return;
                        }
                        if (editingFamilyDateIndex !== null) {
                          const updated = [...familyEventDates];
                          updated[editingFamilyDateIndex] = newFamilyDate;
                          setFamilyEventDates(updated);
                        } else {
                          setFamilyEventDates([...familyEventDates, newFamilyDate]);
                        }
                        setShowAddFamilyDate(false);
                        setNewFamilyDate({ person_name: '', event_type: 'birthday', event_date: '', relation: 'family' });
                        setEditingFamilyDateIndex(null);
                      }}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addFamilyDateButton}
                  onPress={() => setShowAddFamilyDate(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                  <Text style={styles.addFamilyDateButtonText}>Add Family Member Date</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* File Upload */}
            <View style={styles.fileSection}>
              <Text style={styles.label}>Upload Proof (Image/PDF)</Text>
              <View style={styles.fileButtons}>
                <TouchableOpacity style={styles.fileButton} onPress={pickImage}>
                  <Ionicons name="image-outline" size={20} color="#007AFF" />
                  <Text style={styles.fileButtonText}>Pick Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fileButton} onPress={pickFile}>
                  <Ionicons name="document-outline" size={20} color="#007AFF" />
                  <Text style={styles.fileButtonText}>Pick File</Text>
                </TouchableOpacity>
              </View>

              {files.map((file, index) => (
                <View key={index} style={styles.fileItem}>
                  <Text style={styles.fileName}>{file.name}</Text>
                  <TouchableOpacity onPress={() => removeFile(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Consent */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setConsent(!consent)}
            >
              <Ionicons
                name={consent ? 'checkbox' : 'square-outline'}
                size={24}
                color="#007AFF"
              />
              <Text style={styles.checkboxLabel}>
                I accept the terms and conditions and consent to receive messages
              </Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Entry</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    )}
      
      {/* Date Pickers - Render outside ScrollView for Android */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerValue}
          mode="date"
          display="default"
          onChange={handleDatePickerChange}
        />
      )}
      {showFamilyDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={familyDatePickerValue}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowFamilyDatePicker(false);
            if (event.type !== 'dismissed' && selectedDate) {
              setFamilyDatePickerValue(selectedDate);
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setNewFamilyDate({ ...newFamilyDate, event_date: `${year}-${month}-${day}` });
            }
          }}
        />
      )}

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.successModalTitle}>Success!</Text>
            <Text style={styles.successModalMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessMessage('');
                router.replace('/');
              }}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    opacity: 0.8, // Higher opacity to show banner image nicely
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Lighter overlay to show more of the banner image
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  successModalMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  successModalButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: 300,
    marginBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    color: '#000000',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  prizesSection: {
    marginBottom: 24,
  },
  prizeItem: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  prizeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  prizeDetails: {
    fontSize: 14,
    marginBottom: 4,
    color: '#000000',
  },
  prizeQty: {
    fontSize: 14,
    color: '#666',
  },
  formSection: {
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#FFF',
    color: '#000000',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  radioLabel: {
    fontSize: 16,
    textTransform: 'capitalize',
    color: '#000000',
  },
  fileSection: {
    marginBottom: 16,
  },
  fileButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
  },
  fileButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#000000',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateInputContainer: {
    marginBottom: 12,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFF',
  },
  dateInputText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  dateInputPlaceholder: {
    color: '#999',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  iosPickerButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  iosPickerButtonPrimary: {
    color: '#007AFF',
  },
  familyDatesSection: {
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  familyDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  familyDateInfo: {
    flex: 1,
  },
  familyDateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  familyDateDetails: {
    fontSize: 14,
    color: '#666',
  },
  editButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 4,
  },
  addFamilyDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addFamilyDateButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  addFamilyDateForm: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 12,
  },
  familyDateFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

