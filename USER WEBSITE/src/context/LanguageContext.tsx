// ============================================
// Language & Localization Context
// Languages: English, LTR Urdu, RTL Urdu
// Default: LTR Urdu
// English requires an access code (see lib/secrets.ts - never stored in
// plain text here, and overridable with VITE_ENGLISH_ACCESS_CODE)
// ============================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { isEnglishCodeValid } from '../lib/secrets';
import BrandLogo from '../components/BrandLogo';

export type LanguageCode = 'ur-ltr' | 'ur-rtl' | 'en';

export interface Translations {
  [key: string]: string;
}

export const translations: Record<LanguageCode, Translations> = {
  'en': {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.attendance': 'Attendance',
    'nav.students': 'Students',
    'nav.batches': 'Batches',
    'nav.holidays': 'Holidays',
    'nav.fines': 'Fines',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',
    'nav.recycle_bin': 'Recycle Bin',
    'nav.super_admin': 'Super Admin',
    'nav.active_teacher': 'Current Teacher',
    'nav.switch_teacher': 'Switch Teacher',
    'nav.no_teacher': 'No Teacher Selected',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add New',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.name': 'Name',
    'common.phone': 'Phone Number',
    'common.batch': 'Batch',
    'common.date': 'Date',
    'common.month': 'Month',
    'common.loading': 'Loading...',
    'common.confirm': 'Confirm',
    'common.restore': 'Restore',
    'common.permanent_delete': 'Permanently Delete',
    'common.export_csv': 'Export CSV',
    'common.export_pdf': 'Print / PDF',
    'common.pkr': 'PKR',
    'common.close': 'Close',
    'common.success': 'Operation successful',
    'common.error': 'An error occurred',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.total': 'Total',
    'common.preview': 'Preview',
    'common.empty': 'No records found',

    // Language modal
    'lang.modal_title': 'Select Language / زبان کا انتخاب',
    'lang.modal_desc': 'Choose your preferred working language. English requires security authorization.',
    'lang.en': 'English',
    'lang.ur_ltr': 'اردو بائیں سے دائیں (Urdu LTR)',
    'lang.ur_rtl': 'اردو دائیں سے بائیں (Urdu RTL)',
    'lang.password_prompt': 'Enter Authorization Password for English:',
    'lang.password_placeholder': '••••••••',
    'lang.unlock': 'Unlock English',
    'lang.incorrect_password': 'Incorrect password. Access denied.',

    // Teacher Onboarding
    'teacher.who_are_you': 'Who are you? (Select Teacher Profile)',
    'teacher.select_prompt': 'Please choose your teacher identity to access your batches and records:',
    'teacher.select_dropdown': '-- Select Your Teacher Name --',
    'teacher.continue': 'Continue to Dashboard',
    'teacher.admin_note': 'New teacher profiles are created and managed by the Administrator.',

    // Attendance
    'att.title': 'Attendance System',
    'att.subtitle': 'End-of-month bulk entry and AI register scanner',
    'att.ai_scanner': 'AI Register Scanner',
    'att.manual_entry': 'Manual Bulk Entry',
    'att.monthly_summary': 'Monthly Summary & Defaulters',
    'att.upload_register': 'Upload Register Photo',
    'att.scan_processing': 'Analyzing attendance register with AI vision...',
    'att.scan_instruction': 'Upload a clear photo of the handwritten or printed register table (names on left, days 1-31 on top).',
    'att.present': 'Present (P)',
    'att.absent': 'Absent (A)',
    'att.leave': 'Leave (L)',
    'att.premium': 'Premium',
    'att.coming_soon': 'Coming Soon',
    'att.scanner_locked_desc':
      'The AI Register Scanner is a premium feature and is not available yet. It is locked while it is being completed, so it cannot record anything.',
    'att.p': 'P',
    'att.a': 'A',
    'att.l': 'L',
    'att.working_days': 'Working Days',
    'att.allowed_leaves': 'Allowed Leaves',
    'att.attendance_pct': 'Attendance %',
    'att.defaulter': 'Defaulter (<70%)',
    'att.good_standing': 'Good Standing',
    'att.save_attendance': 'Save Attendance Records',
    'att.batch_saved': 'Attendance successfully saved!',

    // Fines
    'fines.title': 'Fine Management & Calculation',
    'fines.subtitle': 'Auto attendance fines and custom disciplinary fines',
    'fines.run_auto': 'Calculate Monthly Auto-Fines',
    'fines.add_custom': 'Add Custom Fine',
    'fines.pending': 'Pending',
    'fines.paid': 'Paid',
    'fines.cancelled': 'Cancelled',
    'fines.mark_paid': 'Mark as Paid',
    'fines.payment_date': 'Payment Date',
    'fines.total_fines': 'Total Fines',
    'fines.pending_amount': 'Pending Collection',
    'fines.paid_amount': 'Collected Amount',
    'fines.confirm_payment': 'Confirm Payment Details',
    'fines.cancel_fine': 'Cancel Fine',

    // Batches & Students
    'batch.title': 'Batches Management',
    'batch.batch_name': 'Batch Name',
    'batch.student_count': 'Total Students',
    'student.title': 'Students Management',
    'student.add_student': 'Add Student',
    'student.bulk_import': 'Bulk Import CSV',
    'student.csv_hint': 'Format: Name, Phone, Batch Name (one per row)',

    // Holidays
    'holiday.title': 'Holiday Calendar',
    'holiday.add_holiday': 'Add Holiday',
    'holiday.label': 'Holiday Name / Reason (e.g. Eid, Rain)',
    'holiday.excluded_note': 'Holidays are automatically deducted from monthly working days.',

    // Settings
    'settings.title': 'Teacher Configuration',
    'settings.min_att': 'Minimum Attendance Percentage (%)',
    'settings.fine_amt': 'Fine Amount (PKR)',
    'settings.max_leaves': 'Maximum Allowed Leaves per Month',
    'settings.primary_color': 'Theme Primary Color',
    'settings.secondary_color': 'Theme Secondary Color',
    'settings.theme_mode': 'Color Scheme',

    // Super Admin
    'admin.title': 'Super Admin Panel',
    'admin.auth_required': 'Admin Security Authorization',
    'admin.password_label': 'Enter Administrator Access Password',
    'admin.login_btn': 'Access Admin Panel',
    'admin.teachers_mgmt': 'Teachers Management',
    'admin.add_teacher': 'Create New Teacher Profile',
    'admin.impersonate': 'Login as Teacher (Impersonate)',
    'admin.global_settings': 'Global Rules & Feature Toggles',
    'admin.database_stats': 'Database Overview & Backup',
    'admin.logs': 'Security & Activity Logs',
    'admin.purge_recycle': 'Purge 30+ Days Old Records',
  },

  'ur-ltr': {
    // Nav
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.attendance': 'حاضری رجسٹر',
    'nav.students': 'طلباء و طالبات',
    'nav.batches': 'کلاس و بیچز',
    'nav.holidays': 'تعطیلات و چھٹیاں',
    'nav.fines': 'جرمانہ جات',
    'nav.reports': 'جامع رپورٹس',
    'nav.settings': 'ترتیبات',
    'nav.recycle_bin': 'کوڑے دان',
    'nav.super_admin': 'سپر ایڈمن',
    'nav.active_teacher': 'موجودہ استاد',
    'nav.switch_teacher': 'استاد تبدیل کریں',
    'nav.no_teacher': 'کوئی استاد منتخب نہیں',

    // Common
    'common.save': 'محفوظ کریں',
    'common.cancel': 'منسوخ',
    'common.delete': 'حذف کریں',
    'common.edit': 'ترمیم',
    'common.add': 'نیا شامل کریں',
    'common.search': 'تلاش کریں...',
    'common.filter': 'فلٹر',
    'common.all': 'تمام',
    'common.actions': 'اقدامات',
    'common.status': 'حالت',
    'common.name': 'نام',
    'common.phone': 'فون نمبر',
    'common.batch': 'بیچ',
    'common.date': 'تاریخ',
    'common.month': 'مہینہ',
    'common.loading': 'لوڈ ہو رہا ہے...',
    'common.confirm': 'تصدیق کریں',
    'common.restore': 'بحال کریں',
    'common.permanent_delete': 'مکمل ختم کریں',
    'common.export_csv': 'CSV ایکسپورٹ',
    'common.export_pdf': 'پرنٹ رپورٹ',
    'common.pkr': 'روپے',
    'common.close': 'بند کریں',
    'common.success': 'کامیابی سے مکمل ہو گیا',
    'common.error': 'کوئی خرابی پیش آ گئی',
    'common.yes': 'جی ہاں',
    'common.no': 'نہیں',
    'common.total': 'کل تعداد',
    'common.preview': 'پیش نظارہ',
    'common.empty': 'کوئی ریکارڈ موجود نہیں',

    // Language modal
    'lang.modal_title': 'زبان کا انتخاب کریں',
    'lang.modal_desc': 'کام کے لیے اپنی زبان منتخب کریں۔ انگریزی زبان کے لیے پاس ورڈ درکار ہے۔',
    'lang.en': 'انگریزی (English)',
    'lang.ur_ltr': 'اردو (بائیں سے دائیں)',
    'lang.ur_rtl': 'اردو (دائیں سے بائیں)',
    'lang.password_prompt': 'انگریزی زبان کے لیے سیکیورٹی پاس ورڈ درج کریں:',
    'lang.password_placeholder': '••••••••',
    'lang.unlock': 'کھولیں',
    'lang.incorrect_password': 'غلط پاس ورڈ! رسائی نامنظور۔',

    // Teacher Onboarding
    'teacher.who_are_you': 'آپ کون ہیں؟ (استاد کا نام منتخب کریں)',
    'teacher.select_prompt': 'اپنے تدریسی ریکارڈز دیکھنے کے لیے نیچے سے اپنا نام منتخب کریں:',
    'teacher.select_dropdown': '-- اپنا نام منتخب کریں --',
    'teacher.continue': 'ڈیش بورڈ پر جائیں',
    'teacher.admin_note': 'نیا استاد کا پروفائل ایڈمنسٹریٹر کی طرف سے شامل کیا جاتا ہے۔',

    // Attendance
    'att.title': 'حاضری رجسٹر و ریکارڈ',
    'att.subtitle': 'ماہانہ اجتماعی حاضری اور مصنوعی ذہانت سکینر',
    'att.ai_scanner': 'مصنوعی ذہانت سکینر',
    'att.manual_entry': 'دستی اندراج',
    'att.monthly_summary': 'ماہانہ جائزہ اور کم حاضری والے طلباء',
    'att.upload_register': 'رجسٹر کی تصویر اپلوڈ کریں',
    'att.scan_processing': 'تصویر کا معائنہ جاری ہے...',
    'att.scan_instruction': 'حاضری رجسٹر کی صاف تصویر اپلوڈ کریں (بائیں طرف طلباء کے نام اور اوپر 1 تا 31 تاریخیں)۔',
    'att.present': 'حاضر (P)',
    'att.absent': 'غیر حاضر (A)',
    'att.leave': 'رخصت (L)',
    'att.premium': 'پریمیم',
    'att.coming_soon': 'بہت جلد آ رہا ہے',
    'att.scanner_locked_desc':
      'مصنوعی ذہانت سکینر ایک پریمیم سہولت ہے اور ابھی دستیاب نہیں۔ مکمل ہونے تک یہ مقفل ہے، اس لیے یہ کوئی ریکارڈ نہیں بنا سکتا۔',
    'att.p': 'P',
    'att.a': 'A',
    'att.l': 'L',
    'att.working_days': 'کل تدریسی دن',
    'att.allowed_leaves': 'مقررہ رخصتیں',
    'att.attendance_pct': 'حاضری کا فیصد',
    'att.defaulter': 'کم حاضری (<70%)',
    'att.good_standing': 'مناسب حاضری',
    'att.save_attendance': 'حاضری محفوظ کریں',
    'att.batch_saved': 'حاضری کامیابی سے محفوظ ہو گئی!',

    // Fines
    'fines.title': 'جرمانہ مینجمنٹ سسٹم',
    'fines.subtitle': 'خودکار ماہانہ جرمانے اور کسٹم فائنز',
    'fines.run_auto': 'خودکار جرمانہ چیک کریں',
    'fines.add_custom': 'اضافی جرمانہ لگائیں',
    'fines.pending': 'باقی',
    'fines.paid': 'ادا شدہ',
    'fines.cancelled': 'منسوخ',
    'fines.mark_paid': 'ادا شدہ درج کریں',
    'fines.payment_date': 'ادائیگی کی تاریخ',
    'fines.total_fines': 'کل جرمانے',
    'fines.pending_amount': 'وصول طلب رقم',
    'fines.paid_amount': 'موصول شدہ رقم',
    'fines.confirm_payment': 'ادائیگی کی تصدیق کریں',
    'fines.cancel_fine': 'جرمانہ منسوخ کریں',

    // Batches & Students
    'batch.title': 'بیچز کا انتظام',
    'batch.batch_name': 'بیچ کا نام',
    'batch.student_count': 'کل طلباء',
    'student.title': 'طلباء کا انتظام',
    'student.add_student': 'نیا طالب علم شامل کریں',
    'student.bulk_import': 'CSV سے طلباء شامل کریں',
    'student.csv_hint': 'طریقہ: نام, فون نمبر, بیچ کا نام',

    // Holidays
    'holiday.title': 'چھٹیوں کا کیلنڈر',
    'holiday.add_holiday': 'نئی چھٹی شامل کریں',
    'holiday.label': 'چھٹی کا عنوان (مثلاً عید، بارش)',
    'holiday.excluded_note': 'چھٹیاں ماہانہ تدریسی دنوں سے خود بخود منہا ہو جاتی ہیں۔',

    // Settings
    'settings.title': 'استاد کی ترتیبات',
    'settings.min_att': 'کم سے کم لازمی حاضری (%)',
    'settings.fine_amt': 'جرمانے کی رقم (روپے)',
    'settings.max_leaves': 'ماہانہ جائز رخصتوں کی حد',
    'settings.primary_color': 'مرکزی رنگ',
    'settings.secondary_color': 'ثانوی رنگ',
    'settings.theme_mode': 'تھیم کا انداز',

    // Super Admin
    'admin.title': 'سپر ایڈمن پینل',
    'admin.auth_required': 'ایڈمن پاس ورڈ درکار ہے',
    'admin.password_label': 'سپر ایڈمن پاس ورڈ درج کریں',
    'admin.login_btn': 'پینل کھولیں',
    'admin.teachers_mgmt': 'اساتذہ کا انتظام',
    'admin.add_teacher': 'نیا استاد شامل کریں',
    'admin.impersonate': 'استاد کے طور پر دیکھیں',
    'admin.global_settings': 'عالمگیر ترتیبات اور کنٹرولز',
    'admin.database_stats': 'ڈیٹابیس اور بیک اپ',
    'admin.logs': 'سیکیورٹی لاگز',
    'admin.purge_recycle': '30 دن پرانا ڈیٹا خودکار ختم کریں',
  },

  'ur-rtl': {
    // Nav
    'nav.dashboard': 'ڈیش بورڈ',
    'nav.attendance': 'حاضری رجسٹر',
    'nav.students': 'طلباء فہرست',
    'nav.batches': 'کلاس و بیچز',
    'nav.holidays': 'سرکاری و نجی چھٹیاں',
    'nav.fines': 'جرمانہ جات',
    'nav.reports': 'جامع رپورٹس',
    'nav.settings': 'ترتیبات',
    'nav.recycle_bin': 'کوڑے دان',
    'nav.super_admin': 'سپر ایڈمن',
    'nav.active_teacher': 'موجودہ استاد',
    'nav.switch_teacher': 'استاد بدلیں',
    'nav.no_teacher': 'استاد منتخب نہیں',

    // Common
    'common.save': 'محفوظ کریں',
    'common.cancel': 'منسوخ',
    'common.delete': 'حذف',
    'common.edit': 'ترمیم',
    'common.add': 'شامل کریں',
    'common.search': 'تلاش کریں...',
    'common.filter': 'فلٹر',
    'common.all': 'سب',
    'common.actions': 'کارروائی',
    'common.status': 'حالت',
    'common.name': 'نام',
    'common.phone': 'فون نمبر',
    'common.batch': 'بیچ',
    'common.date': 'تاریخ',
    'common.month': 'مہینہ',
    'common.loading': 'لوڈ ہو رہا ہے...',
    'common.confirm': 'تصدیق',
    'common.restore': 'بحال کریں',
    'common.permanent_delete': 'مکمل ختم کریں',
    'common.export_csv': 'ایکسپورٹ CSV',
    'common.export_pdf': 'پرنٹ رپورٹ',
    'common.pkr': 'روپے',
    'common.close': 'بند کریں',
    'common.success': 'عمل کامیابی سے مکمل ہو گیا',
    'common.error': 'خرابی پیش آ گئی',
    'common.yes': 'ہاں',
    'common.no': 'نہیں',
    'common.total': 'میزان / کل',
    'common.preview': 'پیش نظارہ',
    'common.empty': 'کوئی مواد موجود نہیں',

    // Language modal
    'lang.modal_title': 'زبان کا انتخاب کریں',
    'lang.modal_desc': 'پینل استعمال کرنے کے لیے زبان منتخب کریں۔ انگریزی کے لیے پاس ورڈ درکار ہے۔',
    'lang.en': 'انگریزی (English)',
    'lang.ur_ltr': 'اردو (بائیں سے دائیں)',
    'lang.ur_rtl': 'اردو (دائیں سے بائیں)',
    'lang.password_prompt': 'انگریزی منتخب کرنے کے لیے پاس ورڈ درج کریں:',
    'lang.password_placeholder': '••••••••',
    'lang.unlock': 'کھولیں',
    'lang.incorrect_password': 'غلط پاس ورڈ! رسائی نہیں ملی۔',

    // Teacher Onboarding
    'teacher.who_are_you': 'آپ کون ہیں؟ استاد کا نام چنیں',
    'teacher.select_prompt': 'اپنے تدریسی ریکارڈز کے لیے اپنا نام منتخب کریں:',
    'teacher.select_dropdown': '-- نام کا انتخاب کریں --',
    'teacher.continue': 'اگے بڑھیں',
    'teacher.admin_note': 'نیا استاد کا پروفائل ایڈمنسٹریٹر کے ذریعے بنایا جاتا ہے۔',

    // Attendance
    'att.title': 'حاضری رجسٹر و ریکارڈ',
    'att.subtitle': 'ماہانہ اجتماعی حاضری اور مصنوعی ذہانت سکینر',
    'att.ai_scanner': 'مصنوعی ذہانت سکینر',
    'att.manual_entry': 'دستی حاضری اندراج',
    'att.monthly_summary': 'ماہانہ جائزہ و کم حاضری لسٹ',
    'att.upload_register': 'رجسٹر کی تصویر منتخب کریں',
    'att.scan_processing': 'تصویر کا معائنہ جاری ہے...',
    'att.scan_instruction': 'حاضری رجسٹر کا واضح صفحہ اپلوڈ کریں۔ نام بائیں جانب اور تواریخ 1 تا 31 اوپر ہوں۔',
    'att.present': 'حاضر (P)',
    'att.absent': 'غیر حاضر (A)',
    'att.leave': 'رخصت (L)',
    'att.p': 'ح',
    'att.a': 'غ',
    'att.l': 'ر',
    'att.working_days': 'تدریسی ایام',
    'att.allowed_leaves': 'مجاز رخصتیں',
    'att.attendance_pct': 'حاضری فی صد',
    'att.defaulter': 'کم حاضری (زیر 70 فیصد)',
    'att.good_standing': 'کامیاب حاضری',
    'att.save_attendance': 'حاضری محفوظ کریں',
    'att.batch_saved': 'حاضری کا ریکارڈ درج ہو گیا!',

    // Fines
    'fines.title': 'جرمانہ نظام و حساب',
    'fines.subtitle': 'حاضری کی بنیاد پر خودکار جرمانہ اور انفرادی جرمانوں کا حساب',
    'fines.run_auto': 'خودکار جرمانہ کیلکولیٹ کریں',
    'fines.add_custom': 'نیا جرمانہ لگائیں',
    'fines.pending': 'زیر التواء',
    'fines.paid': 'وصول شدہ',
    'fines.cancelled': 'معاف / منسوخ',
    'fines.mark_paid': 'وصولی درج کریں',
    'fines.payment_date': 'وصولی کی تاریخ',
    'fines.total_fines': 'کل رقم جرمانہ',
    'fines.pending_amount': 'واجب الاداء رقم',
    'fines.paid_amount': 'کل وصولی',
    'fines.confirm_payment': 'وصولی کی توثیق کریں',
    'fines.cancel_fine': 'جرمانہ ختم کریں',

    // Batches & Students
    'batch.title': 'بیچ و کلاسز',
    'batch.batch_name': 'بیچ نام',
    'batch.student_count': 'تعداد طلباء',
    'student.title': 'طلباء و طالبات',
    'student.add_student': 'نیا طالب علم',
    'student.bulk_import': 'CSV فائل سے امپورٹ',
    'student.csv_hint': 'فارمیٹ: نام, فون, بیچ',

    // Holidays
    'holiday.title': 'تعطیلات و چھٹیاں',
    'holiday.add_holiday': 'چھٹی کا اندراج',
    'holiday.label': 'چھٹی کی وجہ',
    'holiday.excluded_note': 'تمام درج شدہ چھٹیاں تدریسی ایام کے حساب سے نکال دی جاتی ہیں۔',

    // Settings
    'settings.title': 'قواعد و ترتیبات',
    'settings.min_att': 'لازمی کم از کم حاضری (%)',
    'settings.fine_amt': 'جرمانہ فیس (روپے)',
    'settings.max_leaves': 'ماہانہ جائز چھٹیاں',
    'settings.primary_color': 'پسندیدہ رنگ',
    'settings.secondary_color': 'ثانوی رنگ',
    'settings.theme_mode': 'تھیم موڈ',

    // Super Admin
    'admin.title': 'سپر ایڈمن کنٹرول پینل',
    'admin.auth_required': 'انتظامی پاس ورڈ مطلوب ہے',
    'admin.password_label': 'سپر ایڈمن پاس ورڈ',
    'admin.login_btn': 'لاگ ان کریں',
    'admin.teachers_mgmt': 'اساتذہ مینجمنٹ',
    'admin.add_teacher': 'استاد کا نیا کھاتہ بنائیں',
    'admin.impersonate': 'استاد کا پینل معائنہ کریں',
    'admin.global_settings': 'مجموعی قواعد و کنٹرول',
    'admin.database_stats': 'ڈیٹابیس کیفیت و بیک اپ',
    'admin.logs': 'انتظامی لاگز',
    'admin.purge_recycle': 'پرانا ڈیٹا مکمل ختم کریں',
  },
};

interface LanguageContextType {
  language: LanguageCode;
  direction: 'ltr' | 'rtl';
  t: (key: string) => string;
  setLanguage: (lang: LanguageCode) => void;
  showLanguageModal: boolean;
  setShowLanguageModal: (show: boolean) => void;
  requestEnglishLanguage: (onSuccess: () => void) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // CRITICAL REQUIREMENT: Default for first-time users MUST be LTR Urdu
  const [language, setLangState] = useState<LanguageCode>(() => {
    const stored = localStorage.getItem('tuition_language');
    if (stored === 'en' || stored === 'ur-rtl' || stored === 'ur-ltr') {
      return stored as LanguageCode;
    }
    return 'ur-ltr'; // Default is strictly LTR Urdu
  });

  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(() => {
    return !localStorage.getItem('tuition_language');
  });

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingSuccessCallback, setPendingSuccessCallback] = useState<(() => void) | null>(null);

  const direction = language === 'ur-rtl' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language.startsWith('ur') ? 'ur' : 'en';
    if (direction === 'rtl') {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [direction, language]);

  const setLanguage = (lang: LanguageCode) => {
    if (lang === 'en') {
      // Trigger password prompt without showing password on screen
      requestEnglishLanguage(() => {
        setLangState('en');
        localStorage.setItem('tuition_language', 'en');
        setShowLanguageModal(false);
      });
      return;
    }

    setLangState(lang);
    localStorage.setItem('tuition_language', lang);
    setShowLanguageModal(false);
  };

  const requestEnglishLanguage = (onSuccess: () => void) => {
    setPendingSuccessCallback(() => onSuccess);
    setEnteredPassword('');
    setPasswordError(false);
    setPasswordModalOpen(true);
  };

  const handleVerifyEnglishPassword = () => {
    // Constant-time comparison against the obfuscated code (see lib/secrets.ts).
    if (isEnglishCodeValid(enteredPassword)) {
      setPasswordModalOpen(false);
      setPasswordError(false);
      if (pendingSuccessCallback) {
        pendingSuccessCallback();
      } else {
        setLangState('en');
        localStorage.setItem('tuition_language', 'en');
      }
    } else {
      setPasswordError(true);
    }
  };

  const t = (key: string): string => {
    const currentDict = translations[language] || translations['ur-ltr'];
    if (currentDict[key]) return currentDict[key];
    if (translations['ur-ltr'][key]) return translations['ur-ltr'][key];
    if (translations['en'][key]) return translations['en'][key];
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        direction,
        t,
        setLanguage,
        showLanguageModal,
        setShowLanguageModal,
        requestEnglishLanguage,
      }}
    >
      {children}

      {/* First-Time Language Selection Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="text-center mb-6">
              <BrandLogo className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-glow ring-1 ring-black/5 p-2 mb-4" />
              <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                {t('lang.modal_title')}
              </h2>
              <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-2">
                {t('lang.modal_desc')}
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Urdu LTR (Default / Pre-selected) */}
              <button
                type="button"
                onClick={() => setLanguage('ur-ltr')}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  language === 'ur-ltr'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 text-primary-900 dark:text-primary-200 ring-2 ring-primary-500/20 shadow-sm'
                    : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50 text-surface-800 dark:text-surface-200'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm">اردو (بائیں سے دائیں) - LTR Urdu</div>
                  <div className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">تجویز کردہ اور بنیادی انتخاب (Default)</div>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-lg">
                  تجویز کردہ
                </span>
              </button>

              {/* Option 2: Urdu RTL */}
              <button
                type="button"
                onClick={() => setLanguage('ur-rtl')}
                className={`w-full p-4 rounded-2xl border text-right flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  language === 'ur-rtl'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 text-primary-900 dark:text-primary-200 ring-2 ring-primary-500/20 shadow-sm'
                    : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50 text-surface-800 dark:text-surface-200'
                }`}
              >
                <span className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-lg">
                  روایتی
                </span>
                <div>
                  <div className="font-semibold text-sm">اردو (دائیں سے بائیں) - RTL Urdu</div>
                  <div className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">مکمل دائیں سے بائیں لے آؤٹ کے ساتھ</div>
                </div>
              </button>

              {/* Option 3: English (Protected by Authorization Password) */}
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  language === 'en'
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 text-primary-900 dark:text-primary-200 ring-2 ring-primary-500/20 shadow-sm'
                    : 'border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-700/50 text-surface-800 dark:text-surface-200'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm">English</div>
                  <div className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Protected (Authorization Required)</div>
                </div>
                <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg flex items-center gap-1 font-medium">
                  🔒 Password
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Authorization Modal for English (Password never exposed in UI) */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-surface-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-glass-lg border border-surface-200 dark:border-surface-700 animate-scale-in">
            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl mb-3">
                🔒
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                Security Authorization
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                Enter security authorization password to enable English language:
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••••••"
                  value={enteredPassword}
                  onChange={(e) => {
                    setEnteredPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyEnglishPassword()}
                  className="w-full px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 text-center font-mono tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {passwordError && (
                  <p className="text-xs text-rose-500 text-center mt-2 font-medium">
                    Incorrect password! Access denied.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="btn-secondary flex-1 py-2.5 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyEnglishPassword}
                  className="btn-primary flex-1 py-2.5 text-sm"
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
