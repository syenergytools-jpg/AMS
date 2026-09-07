"use client";

import { Document, Page, View, Text, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";
import type { Profile, SalarySlip } from "@/lib/types";

export interface AttendanceSummary {
  workingDays: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: "Helvetica", color: "#0b1b2e" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    borderBottom: "2 solid #0b1b2e",
    paddingBottom: 12,
  },
  company: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 9, color: "#64748b", marginTop: 2 },
  title: { fontSize: 14, fontWeight: 700, textAlign: "right" },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#94a3b8",
    marginBottom: 6,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#475569" },
  value: { fontWeight: 700 },
  table: { borderTop: "1 solid #e2e8f0" },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottom: "1 solid #f1f5f9",
  },
  netPayBox: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  netPayLabel: { fontSize: 11, color: "#166534" },
  netPayValue: { fontSize: 18, fontWeight: 700, color: "#166534" },
  footer: { marginTop: 24, fontSize: 8, color: "#94a3b8", textAlign: "center" },
});

function Line({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function SalarySlipDocument({
  profile,
  slip,
  monthLabel,
  attendanceSummary,
}: {
  profile: Profile;
  slip: SalarySlip;
  monthLabel: string;
  attendanceSummary: AttendanceSummary;
}) {
  const netPay = slip.basic_salary + slip.allowances - slip.deductions;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>Evolut Ecommerce Solutions</Text>
            <Text style={styles.sub}>Jhelum, Pakistan</Text>
          </View>
          <View>
            <Text style={styles.title}>Salary Slip</Text>
            <Text style={styles.sub}>{monthLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee</Text>
          <Line label="Name" value={profile.full_name} />
          <Line label="Position" value={profile.position || "—"} />
          <Line label="Department" value={profile.department || "—"} />
          <Line label="CNIC" value={profile.cnic || "—"} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance this month</Text>
          <Line label="Working days" value={attendanceSummary.workingDays} />
          <Line label="Present" value={attendanceSummary.present} />
          <Line label="Late" value={attendanceSummary.late} />
          <Line label="On leave" value={attendanceSummary.onLeave} />
          <Line label="Absent" value={attendanceSummary.absent} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings &amp; deductions</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Basic salary</Text>
              <Text style={styles.value}>{formatCurrency(slip.basic_salary)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Allowances</Text>
              <Text style={styles.value}>{formatCurrency(slip.allowances)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.label}>Deductions</Text>
              <Text style={styles.value}>-{formatCurrency(slip.deductions)}</Text>
            </View>
          </View>
          <View style={styles.netPayBox}>
            <Text style={styles.netPayLabel}>Net Pay</Text>
            <Text style={styles.netPayValue}>{formatCurrency(netPay)}</Text>
          </View>
        </View>

        {slip.note && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note</Text>
            <Text>{slip.note}</Text>
          </View>
        )}

        <Text style={styles.footer}>
          This is a computer-generated salary slip and does not require a signature.
        </Text>
      </Page>
    </Document>
  );
}

export function SalarySlipDownloadButton({
  profile,
  slip,
  monthLabel,
  monthKey,
  attendanceSummary,
}: {
  profile: Profile;
  slip: SalarySlip;
  monthLabel: string;
  monthKey: string;
  attendanceSummary: AttendanceSummary;
}) {
  return (
    <PDFDownloadLink
      document={
        <SalarySlipDocument
          profile={profile}
          slip={slip}
          monthLabel={monthLabel}
          attendanceSummary={attendanceSummary}
        />
      }
      fileName={`salary-slip-${profile.full_name.trim().replace(/\s+/g, "-").toLowerCase()}-${monthKey}.pdf`}
      className="btn-primary"
    >
      {({ loading }) => (loading ? "Preparing…" : "Download PDF")}
    </PDFDownloadLink>
  );
}
