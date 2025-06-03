$(document).ready(function() {
    // Inisialisasi DataTable dengan format serverSide
    const table = $('#earthquakeTable').DataTable({
        processing: true,
        serverSide: true,
        ajax: {
            url: '/api/historical-data',
            data: function(d) {
                // Tambahkan parameter filter kustom
                d.mag_min = $('#magnitudeMin').val() || null;
                d.mag_max = $('#magnitudeMax').val() || null;
                d.depth_min = $('#depthMin').val() || null;
                d.depth_max = $('#depthMax').val() || null;
                d.year_min = $('#yearMin').val() || null;
                d.year_max = $('#yearMax').val() || null;
                return d;
            }
        },
        columns: [
            { data: 'No' },
            { 
                data: 'date_time',
                defaultContent: '-'
            },
            { data: 'latitude' },
            { data: 'longitude' },
            { data: 'depth' },
            { data: 'magnitude' },
            { 
                data: 'location',
                defaultContent: '-'
            },
            { 
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    return '<button class="detail-btn">Lihat</button>';
                }
            }
        ],
        pageLength: 25,
        responsive: true,
        order: [[0, 'desc']]
    });
    
    // Terapkan filter kustom
    $('#applyFilters').click(function() {
        table.ajax.reload();
    });
    
    // Reset filter
    $('#resetFilters').click(function() {
        $('#magnitudeMin').val('');
        $('#magnitudeMax').val('');
        $('#depthMin').val('');
        $('#depthMax').val('');
        $('#yearMin').val('');
        $('#yearMax').val('');
        table.ajax.reload();
    });
    
    // Download data sebagai CSV
    $('#downloadCSV').click(function() {
        // Dapatkan nilai filter saat ini
        const magMin = $('#magnitudeMin').val() || '';
        const magMax = $('#magnitudeMax').val() || '';
        const depthMin = $('#depthMin').val() || '';
        const depthMax = $('#depthMax').val() || '';
        const yearMin = $('#yearMin').val() || '';
        const yearMax = $('#yearMax').val() || '';
        
        // Buat URL download dengan filter
        let downloadUrl = '/api/download-csv?';
        if (magMin) downloadUrl += `mag_min=${magMin}&`;
        if (magMax) downloadUrl += `mag_max=${magMax}&`;
        if (depthMin) downloadUrl += `depth_min=${depthMin}&`;
        if (depthMax) downloadUrl += `depth_max=${depthMax}&`;
        if (yearMin) downloadUrl += `year_min=${yearMin}&`;
        if (yearMax) downloadUrl += `year_max=${yearMax}&`;
        
        window.location.href = downloadUrl;
    });
    
    // Tangani klik tombol detail
    $('#earthquakeTable tbody').on('click', 'button.detail-btn', function() {
        const data = table.row($(this).parents('tr')).data();
        showQuakeDetails(data);
    });
    
    // Fungsi untuk menampilkan detail gempa
    function showQuakeDetails(quakeData) {
        // Buat konten HTML untuk modal
        let detailHTML = '<table class="detail-table">';
        
        const fieldNames = {
            'id': 'ID',
            'event_id': 'Event ID',
            'date_time': 'Date & Time',
            'latitude': 'Latitude',
            'longitude': 'Longitude',
            'magnitude': 'Magnitude',
            'mag_type': 'Magnitude Type',
            'depth': 'Depth (km)',
            'phase_count': 'Phase Count',
            'azimuth_gap': 'Azimuth Gap',
            'location': 'Location',
            'agency': 'Agency'
        };
        
        // Tambahkan semua properti yang tersedia ke tampilan detail
        for (const [key, value] of Object.entries(quakeData)) {
            if (key !== 'No' && value !== null && value !== undefined) {
                const displayName = fieldNames[key] || key;
                detailHTML += `
                    <tr>
                        <td><strong>${displayName}</strong></td>
                        <td>${value}</td>
                    </tr>
                `;
            }
        }
        
        detailHTML += '</table>';
        
        // Tampilkan modal dengan detail
        showModal('Detail Gempa Bumi', detailHTML);
    }
    
    // Fungsi untuk menampilkan modal
    function showModal(title, content) {
        // Jika modal belum ada, buat baru
        if (!$('#detailModal').length) {
            $('body').append(`
                <div id="detailModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <span class="close">&times;</span>
                            <h3 id="modalTitle"></h3>
                        </div>
                        <div class="modal-body" id="modalContent"></div>
                    </div>
                </div>
            `);
            
            // Tambahkan event listener untuk tombol close
            $(document).on('click', '#detailModal .close', function() {
                $('#detailModal').hide();
            });
            
            // Tutup modal ketika klik di luar modal
            $(window).on('click', function(event) {
                if ($(event.target).is('#detailModal')) {
                    $('#detailModal').hide();
                }
            });
        }
        
        // Set judul dan konten
        $('#modalTitle').text(title);
        $('#modalContent').html(content);
        
        // Tampilkan modal
        $('#detailModal').show();
    }
});