const {createApp, ref, computed} = Vue;

createApp({
    setup() {
        const today = new Date().toISOString().slice(0, 10);

        const transactionType = ref('donation');
        const date = ref(today);
        const worldDonations = ref(0);
        const localDonations = ref(0);
        const concept1 = ref('');
        const amount1 = ref(0);
        const concept2 = ref('');
        const amount2 = ref(0);
        const concept3 = ref('');
        const amount3 = ref(0);
        const s24capture = ref(null);

        const isDonationDisabled = computed(() => ['payment', 'cashAdvance'].includes(transactionType.value));
        const donationsSubTotal = computed(() => isDonationDisabled.value ? 0 : worldDonations.value + localDonations.value);
        const othersSubTotal = computed(() => amount1.value + amount2.value + amount3.value);
        const grandTotal = computed(() => donationsSubTotal.value + othersSubTotal.value);

        function handleFileChange(event) {
            if (event.target.files.length > 0) {
                s24capture.value = event.target.files[0];
            }
        }

        return {
            transactionType,
            date,
            isDonationDisabled,
            worldDonations,
            localDonations,
            concept1,
            amount1,
            concept2,
            amount2,
            concept3,
            amount3,
            s24capture,
            donationsSubTotal,
            othersSubTotal,
            grandTotal,
            handleFileChange,
        };
    }
}).mount('#transactionForm');