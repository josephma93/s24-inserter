const app = Vue.createApp({
    data() {
        return {
            messages: []
        };
    },
    methods: {
        alertClass(status) {
            switch (status) {
                case 'error':
                    return 'alert-danger';
                case 'info':
                    return 'alert-info';
                case 'debug':
                    return 'alert-secondary';
                default:
                    return 'alert-primary';
            }
        }
    },
    mounted() {
        const eventSource = new EventSource('/events');
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.messages.push({
                id: this.messages.length,
                status: data.status,
                message: data.message
            });
            this.$nextTick(() => {
                const messagesDiv = this.$refs.messages;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
        };
    }
});

app.mount('#app');