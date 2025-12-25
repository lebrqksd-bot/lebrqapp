import AdminHeader from '@/components/admin/AdminHeader';
import SuccessModal from '@/components/SuccessModal';
import { ThemedText } from '@/components/themed-text';
import { CONFIG } from '@/constants/config';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const API_BASE = CONFIG.API_BASE_URL;

type StaffFormData = {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    date_of_birth: string | null;
    address: string;
    aadhar_number: string;
    pan_number: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relation: string;
    role: string;
    department: string;
    salary_type: 'monthly' | 'hourly';
    fixed_salary: string;
    hourly_wage: string;
    joining_date: string;
    hra: string;
    travel: string;
    food: string;
    pf: string;
    esi: string;
    tds: string;
    is_active: boolean;
};

export default function StaffFormPage() {
    const params = useLocalSearchParams<{ id?: string }>();
    const id = params?.id;
    const isEdit = !!id;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<StaffFormData>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: null,
        address: '',
        aadhar_number: '',
        pan_number: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relation: '',
        role: '',
        department: '',
        salary_type: 'monthly',
        fixed_salary: '',
        hourly_wage: '',
        joining_date: new Date().toISOString().split('T')[0],
        hra: '',
        travel: '',
        food: '',
        pf: '',
        esi: '',
        tds: '',
        is_active: true,
    });

    const [showDobPicker, setShowDobPicker] = useState(false);
    const [showJoiningPicker, setShowJoiningPicker] = useState(false);
    const [dobDate, setDobDate] = useState(new Date());
    const [joiningDate, setJoiningDate] = useState(new Date());
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        if (isEdit && id) {
            loadStaff();
        }
    }, [id, isEdit]);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const response = await fetch(`${API_BASE}/hr/staff/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to load staff');
            }

            const data = await response.json();
            setFormData({
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                email: data.email || '',
                phone: data.phone || '',
                date_of_birth: data.date_of_birth || null,
                address: data.address || '',
                aadhar_number: data.aadhar_number || '',
                pan_number: data.pan_number || '',
                emergency_contact_name: data.emergency_contact_name || '',
                emergency_contact_phone: data.emergency_contact_phone || '',
                emergency_contact_relation: data.emergency_contact_relation || '',
                role: data.role || '',
                department: data.department || '',
                salary_type: data.salary_type || 'monthly',
                fixed_salary: data.fixed_salary?.toString() || '',
                hourly_wage: data.hourly_wage?.toString() || '',
                joining_date: data.joining_date || new Date().toISOString().split('T')[0],
                hra: data.allowances?.hra?.toString() || '',
                travel: data.allowances?.travel?.toString() || '',
                food: data.allowances?.food?.toString() || '',
                pf: data.deductions?.pf?.toString() || '',
                esi: data.deductions?.esi?.toString() || '',
                tds: data.deductions?.tds?.toString() || '',
                is_active: data.is_active ?? true,
            });

            if (data.date_of_birth) {
                setDobDate(new Date(data.date_of_birth));
            }
            if (data.joining_date) {
                setJoiningDate(new Date(data.joining_date));
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to load staff');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.first_name.trim()) {
            newErrors.first_name = 'First name is required';
        }

        if (!formData.last_name.trim()) {
            newErrors.last_name = 'Last name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email.trim())) {
                newErrors.email = 'Invalid email format';
            }
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone is required';
        } else {
            const phoneRegex = /^[0-9]{10}$/;
            if (!phoneRegex.test(formData.phone.trim().replace(/[\s-]/g, ''))) {
                newErrors.phone = 'Phone must be 10 digits';
            }
        }

        if (!formData.role.trim()) {
            newErrors.role = 'Role/Designation is required';
        }

        if (!formData.department.trim()) {
            newErrors.department = 'Department is required';
        }

        if (formData.salary_type === 'monthly' && !formData.fixed_salary.trim()) {
            newErrors.fixed_salary = 'Fixed salary is required';
        } else if (formData.salary_type === 'monthly' && formData.fixed_salary.trim()) {
            const salary = parseFloat(formData.fixed_salary);
            if (isNaN(salary) || salary <= 0) {
                newErrors.fixed_salary = 'Salary must be a positive number';
            }
        }

        if (formData.salary_type === 'hourly' && !formData.hourly_wage.trim()) {
            newErrors.hourly_wage = 'Hourly wage is required';
        } else if (formData.salary_type === 'hourly' && formData.hourly_wage.trim()) {
            const wage = parseFloat(formData.hourly_wage);
            if (isNaN(wage) || wage <= 0) {
                newErrors.hourly_wage = 'Wage must be a positive number';
            }
        }

        if (!formData.joining_date) {
            newErrors.joining_date = 'Joining date is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        // Clear previous errors
        setErrors({});

        // Validate form
        if (!validateForm()) {
            Alert.alert('Validation Error', 'Please fix the errors in the form');
            return;
        }

        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('admin_token');
            if (!token) {
                router.replace('/admin/login');
                return;
            }

            const payload: any = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                role: formData.role.trim(),
                department: formData.department.trim(),
                salary_type: formData.salary_type,
                joining_date: formData.joining_date,
            };

            if (formData.date_of_birth) payload.date_of_birth = formData.date_of_birth;
            if (formData.address.trim()) payload.address = formData.address.trim();
            if (formData.aadhar_number.trim()) payload.aadhar_number = formData.aadhar_number.trim();
            if (formData.pan_number.trim()) payload.pan_number = formData.pan_number.trim();
            if (formData.emergency_contact_name.trim()) payload.emergency_contact_name = formData.emergency_contact_name.trim();
            if (formData.emergency_contact_phone.trim()) payload.emergency_contact_phone = formData.emergency_contact_phone.trim();
            if (formData.emergency_contact_relation.trim()) payload.emergency_contact_relation = formData.emergency_contact_relation.trim();

            if (formData.salary_type === 'monthly') {
                payload.fixed_salary = parseFloat(formData.fixed_salary) || 0;
            } else {
                payload.hourly_wage = parseFloat(formData.hourly_wage) || 0;
            }

            // Allowances
            const allowances: any = {};
            if (formData.hra.trim()) allowances.hra = parseFloat(formData.hra) || 0;
            if (formData.travel.trim()) allowances.travel = parseFloat(formData.travel) || 0;
            if (formData.food.trim()) allowances.food = parseFloat(formData.food) || 0;
            if (Object.keys(allowances).length > 0) payload.allowances = allowances;

            // Deductions
            const deductions: any = {};
            if (formData.pf.trim()) deductions.pf = parseFloat(formData.pf) || 0;
            if (formData.esi.trim()) deductions.esi = parseFloat(formData.esi) || 0;
            if (formData.tds.trim()) deductions.tds = parseFloat(formData.tds) || 0;
            if (Object.keys(deductions).length > 0) payload.deductions = deductions;

            const url = isEdit ? `${API_BASE}/hr/staff/${id}` : `${API_BASE}/hr/staff`;
            const method = isEdit ? 'PUT' : 'POST';

            if (isEdit) {
                payload.is_active = formData.is_active;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || 'Failed to save staff';
                
                // Handle specific validation errors from backend
                if (errorData.errors) {
                    setErrors(errorData.errors);
                    Alert.alert('Validation Error', 'Please fix the errors in the form');
                    return;
                }
                
                // Handle duplicate email/phone
                if (errorMessage.includes('email') || errorMessage.includes('Email')) {
                    setErrors({ email: 'Email already exists' });
                    Alert.alert('Error', 'Email already exists');
                    return;
                }
                if (errorMessage.includes('phone') || errorMessage.includes('Phone')) {
                    setErrors({ phone: 'Phone number already exists' });
                    Alert.alert('Error', 'Phone number already exists');
                    return;
                }
                
                throw new Error(errorMessage);
            }

            // Show success modal
            setSuccessMessage(isEdit ? 'Staff updated successfully' : 'Staff created successfully');
            setShowSuccessModal(true);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save staff');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <AdminHeader title={isEdit ? 'Edit Staff' : 'Add Staff'} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <ThemedText style={styles.loadingText}>Loading...</ThemedText>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <AdminHeader title={isEdit ? 'Edit Staff' : 'Add Staff'} />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Personal Details */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Personal Details</ThemedText>
                    <TextInput
                        style={[styles.input, errors.first_name && styles.inputError]}
                        placeholder="First Name *"
                        value={formData.first_name}
                        onChangeText={(text) => {
                            setFormData({ ...formData, first_name: text });
                            if (errors.first_name) setErrors({ ...errors, first_name: '' });
                        }}
                    />
                    {errors.first_name && <ThemedText style={styles.errorText}>{errors.first_name}</ThemedText>}
                    <TextInput
                        style={[styles.input, errors.last_name && styles.inputError]}
                        placeholder="Last Name *"
                        value={formData.last_name}
                        onChangeText={(text) => {
                            setFormData({ ...formData, last_name: text });
                            if (errors.last_name) setErrors({ ...errors, last_name: '' });
                        }}
                    />
                    {errors.last_name && <ThemedText style={styles.errorText}>{errors.last_name}</ThemedText>}
                    <TextInput
                        style={[styles.input, errors.email && styles.inputError]}
                        placeholder="Email *"
                        value={formData.email}
                        onChangeText={(text) => {
                            setFormData({ ...formData, email: text });
                            if (errors.email) setErrors({ ...errors, email: '' });
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    {errors.email && <ThemedText style={styles.errorText}>{errors.email}</ThemedText>}
                    <TextInput
                        style={[styles.input, errors.phone && styles.inputError]}
                        placeholder="Phone *"
                        value={formData.phone}
                        onChangeText={(text) => {
                            setFormData({ ...formData, phone: text });
                            if (errors.phone) setErrors({ ...errors, phone: '' });
                        }}
                        keyboardType="phone-pad"
                        maxLength={10}
                    />
                    {errors.phone && <ThemedText style={styles.errorText}>{errors.phone}</ThemedText>}
                    {Platform.OS === 'web' ? (
                        <input
                            type="date"
                            value={formData.date_of_birth || ''}
                            onChange={(e) => {
                                if (e.target.value) {
                                    const date = new Date(e.target.value);
                                    setDobDate(date);
                                    setFormData({ ...formData, date_of_birth: e.target.value });
                                }
                            }}
                            max={new Date().toISOString().split('T')[0]}
                            style={{
                                borderWidth: '1px',
                                borderColor: '#e5e7eb',
                                borderRadius: '8px',
                                padding: '12px',
                                fontSize: '14px',
                                color: '#111827',
                                backgroundColor: '#fff',
                                marginBottom: '12px',
                                width: '100%',
                            }}
                        />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.dateInput}
                                onPress={() => setShowDobPicker(true)}
                            >
                                <ThemedText style={styles.dateInputText}>
                                    Date of Birth: {formData.date_of_birth ? new Date(formData.date_of_birth).toLocaleDateString() : 'Select date'}
                                </ThemedText>
                                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                            </TouchableOpacity>
                            {showDobPicker && (
                                Platform.OS === 'ios' ? (
                            <Modal
                                visible={showDobPicker}
                                transparent
                                animationType="slide"
                                onRequestClose={() => setShowDobPicker(false)}
                            >
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <ThemedText style={styles.modalTitle}>Select Date of Birth</ThemedText>
                                            <TouchableOpacity onPress={() => setShowDobPicker(false)}>
                                                <Ionicons name="close" size={24} color="#6b7280" />
                                            </TouchableOpacity>
                                        </View>
                                        <DateTimePicker
                                            value={dobDate}
                                            mode="date"
                                            display="spinner"
                                            maximumDate={new Date()}
                                            onChange={(event, date) => {
                                                if (date) {
                                                    setDobDate(date);
                                                    setFormData({ ...formData, date_of_birth: date.toISOString().split('T')[0] });
                                                }
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={styles.modalButton}
                                            onPress={() => setShowDobPicker(false)}
                                        >
                                            <ThemedText style={styles.modalButtonText}>Done</ThemedText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Modal>
                        ) : (
                            <DateTimePicker
                                value={dobDate}
                                mode="date"
                                display="default"
                                maximumDate={new Date()}
                                onChange={(event, date) => {
                                    setShowDobPicker(false);
                                    if (date) {
                                        setDobDate(date);
                                        setFormData({ ...formData, date_of_birth: date.toISOString().split('T')[0] });
                                    }
                                }}
                            />
                        )
                            )}
                        </>
                    )}
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Address"
                        value={formData.address}
                        onChangeText={(text) => setFormData({ ...formData, address: text })}
                        multiline
                        numberOfLines={3}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Aadhar Number"
                        value={formData.aadhar_number}
                        onChangeText={(text) => setFormData({ ...formData, aadhar_number: text })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="PAN Number"
                        value={formData.pan_number}
                        onChangeText={(text) => setFormData({ ...formData, pan_number: text })}
                    />
                </View>

                {/* Emergency Contact */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Emergency Contact</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Contact Name"
                        value={formData.emergency_contact_name}
                        onChangeText={(text) => setFormData({ ...formData, emergency_contact_name: text })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Contact Phone"
                        value={formData.emergency_contact_phone}
                        onChangeText={(text) => setFormData({ ...formData, emergency_contact_phone: text })}
                        keyboardType="phone-pad"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Relation"
                        value={formData.emergency_contact_relation}
                        onChangeText={(text) => setFormData({ ...formData, emergency_contact_relation: text })}
                    />
                </View>

                {/* Job Details */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Job Details</ThemedText>
                    <TextInput
                        style={[styles.input, errors.role && styles.inputError]}
                        placeholder="Role/Designation *"
                        value={formData.role}
                        onChangeText={(text) => {
                            setFormData({ ...formData, role: text });
                            if (errors.role) setErrors({ ...errors, role: '' });
                        }}
                    />
                    {errors.role && <ThemedText style={styles.errorText}>{errors.role}</ThemedText>}
                    <TextInput
                        style={[styles.input, errors.department && styles.inputError]}
                        placeholder="Department *"
                        value={formData.department}
                        onChangeText={(text) => {
                            setFormData({ ...formData, department: text });
                            if (errors.department) setErrors({ ...errors, department: '' });
                        }}
                    />
                    {errors.department && <ThemedText style={styles.errorText}>{errors.department}</ThemedText>}
                    {Platform.OS === 'web' ? (
                        <>
                            <input
                                type="date"
                                value={formData.joining_date || ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        const date = new Date(e.target.value);
                                        setJoiningDate(date);
                                        setFormData({ ...formData, joining_date: e.target.value });
                                        if (errors.joining_date) setErrors({ ...errors, joining_date: '' });
                                    }
                                }}
                                max={new Date().toISOString().split('T')[0]}
                                style={{
                                    borderWidth: errors.joining_date ? '2px' : '1px',
                                    borderColor: errors.joining_date ? '#FF3B30' : '#e5e7eb',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '14px',
                                    color: '#111827',
                                    backgroundColor: '#fff',
                                    marginBottom: '12px',
                                    width: '100%',
                                }}
                            />
                            {errors.joining_date && <ThemedText style={styles.errorText}>{errors.joining_date}</ThemedText>}
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.dateInput, errors.joining_date && styles.inputError]}
                                onPress={() => setShowJoiningPicker(true)}
                            >
                                <ThemedText style={styles.dateInputText}>
                                    Joining Date *: {formData.joining_date ? new Date(formData.joining_date).toLocaleDateString() : 'Select date'}
                                </ThemedText>
                                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                            </TouchableOpacity>
                            {errors.joining_date && <ThemedText style={styles.errorText}>{errors.joining_date}</ThemedText>}
                            {showJoiningPicker && (
                                Platform.OS === 'ios' ? (
                            <Modal
                                visible={showJoiningPicker}
                                transparent
                                animationType="slide"
                                onRequestClose={() => setShowJoiningPicker(false)}
                            >
                                <View style={styles.modalOverlay}>
                                    <View style={styles.modalContent}>
                                        <View style={styles.modalHeader}>
                                            <ThemedText style={styles.modalTitle}>Select Joining Date</ThemedText>
                                            <TouchableOpacity onPress={() => setShowJoiningPicker(false)}>
                                                <Ionicons name="close" size={24} color="#6b7280" />
                                            </TouchableOpacity>
                                        </View>
                                        <DateTimePicker
                                            value={joiningDate}
                                            mode="date"
                                            display="spinner"
                                            maximumDate={new Date()}
                                            onChange={(event, date) => {
                                                if (date) {
                                                    setJoiningDate(date);
                                                    setFormData({ ...formData, joining_date: date.toISOString().split('T')[0] });
                                                    if (errors.joining_date) setErrors({ ...errors, joining_date: '' });
                                                }
                                            }}
                                        />
                                        <TouchableOpacity
                                            style={styles.modalButton}
                                            onPress={() => setShowJoiningPicker(false)}
                                        >
                                            <ThemedText style={styles.modalButtonText}>Done</ThemedText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Modal>
                        ) : (
                            <DateTimePicker
                                value={joiningDate}
                                mode="date"
                                display="default"
                                maximumDate={new Date()}
                                onChange={(event, date) => {
                                    setShowJoiningPicker(false);
                                    if (date) {
                                        setJoiningDate(date);
                                        setFormData({ ...formData, joining_date: date.toISOString().split('T')[0] });
                                        if (errors.joining_date) setErrors({ ...errors, joining_date: '' });
                                    }
                                }}
                            />
                        )
                            )}
                        </>
                    )}
                    <View style={styles.salaryTypeContainer}>
                        <ThemedText style={styles.label}>Salary Type *</ThemedText>
                        <View style={styles.radioGroup}>
                            <TouchableOpacity
                                style={[styles.radioButton, formData.salary_type === 'monthly' && styles.radioButtonActive]}
                                onPress={() => setFormData({ ...formData, salary_type: 'monthly' })}
                            >
                                <ThemedText style={[styles.radioText, formData.salary_type === 'monthly' && styles.radioTextActive]}>
                                    Monthly
                                </ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.radioButton, formData.salary_type === 'hourly' && styles.radioButtonActive]}
                                onPress={() => setFormData({ ...formData, salary_type: 'hourly' })}
                            >
                                <ThemedText style={[styles.radioText, formData.salary_type === 'hourly' && styles.radioTextActive]}>
                                    Hourly
                                </ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {formData.salary_type === 'monthly' ? (
                        <>
                            <TextInput
                                style={[styles.input, errors.fixed_salary && styles.inputError]}
                                placeholder="Fixed Salary (₹) *"
                                value={formData.fixed_salary}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, fixed_salary: text });
                                    if (errors.fixed_salary) setErrors({ ...errors, fixed_salary: '' });
                                }}
                                keyboardType="numeric"
                            />
                            {errors.fixed_salary && <ThemedText style={styles.errorText}>{errors.fixed_salary}</ThemedText>}
                        </>
                    ) : (
                        <>
                            <TextInput
                                style={[styles.input, errors.hourly_wage && styles.inputError]}
                                placeholder="Hourly Wage (₹) *"
                                value={formData.hourly_wage}
                                onChangeText={(text) => {
                                    setFormData({ ...formData, hourly_wage: text });
                                    if (errors.hourly_wage) setErrors({ ...errors, hourly_wage: '' });
                                }}
                                keyboardType="numeric"
                            />
                            {errors.hourly_wage && <ThemedText style={styles.errorText}>{errors.hourly_wage}</ThemedText>}
                        </>
                    )}
                </View>

                {/* Allowances */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Allowances (₹)</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="HRA"
                        value={formData.hra}
                        onChangeText={(text) => setFormData({ ...formData, hra: text })}
                        keyboardType="numeric"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Travel Allowance"
                        value={formData.travel}
                        onChangeText={(text) => setFormData({ ...formData, travel: text })}
                        keyboardType="numeric"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Food Allowance"
                        value={formData.food}
                        onChangeText={(text) => setFormData({ ...formData, food: text })}
                        keyboardType="numeric"
                    />
                </View>

                {/* Deductions */}
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Deductions (₹)</ThemedText>
                    <TextInput
                        style={styles.input}
                        placeholder="Provident Fund (PF)"
                        value={formData.pf}
                        onChangeText={(text) => setFormData({ ...formData, pf: text })}
                        keyboardType="numeric"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="ESI"
                        value={formData.esi}
                        onChangeText={(text) => setFormData({ ...formData, esi: text })}
                        keyboardType="numeric"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="TDS"
                        value={formData.tds}
                        onChangeText={(text) => setFormData({ ...formData, tds: text })}
                        keyboardType="numeric"
                    />
                </View>

                {/* Status (Edit only) */}
                {isEdit && (
                    <View style={styles.section}>
                        <View style={styles.switchRow}>
                            <ThemedText style={styles.label}>Active Status</ThemedText>
                            <Switch
                                value={formData.is_active}
                                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                            />
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <ThemedText style={styles.saveButtonText}>
                            {isEdit ? 'Update Staff' : 'Create Staff'}
                        </ThemedText>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Success Modal */}
            <SuccessModal
                visible={showSuccessModal}
                message={successMessage}
                duration={2000}
                onClose={() => {
                    setShowSuccessModal(false);
                    router.back();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6f6',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
        marginBottom: 12,
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
        marginBottom: 12,
    },
    dateInputText: {
        fontSize: 14,
        color: '#111827',
    },
    salaryTypeContainer: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    radioGroup: {
        flexDirection: 'row',
        gap: 12,
    },
    radioButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    radioButtonActive: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    radioText: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },
    radioTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    saveButton: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 32,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    inputError: {
        borderColor: '#FF3B30',
        borderWidth: 2,
    },
    errorText: {
        color: '#FF3B30',
        fontSize: 12,
        marginTop: -8,
        marginBottom: 8,
        marginLeft: 4,
    },
    webDateInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
        marginBottom: 12,
        width: '100%',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        width: '90%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    modalButton: {
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    webDateInput: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        backgroundColor: '#fff',
        marginBottom: 12,
        width: '100%',
    },
});

