// Unit Edit Page JavaScript

CasaConnect.ready(() => {
    const form = document.getElementById('editUnitForm');
    if (form) {
        const unitId = form.getAttribute('data-unit-id');
        UnitEditManager.init(unitId);
    }
});

const UnitEditManager = {
    unitId: null,

    init(unitId) {
        this.unitId = unitId;
        this.initializeForm();
        this.initializeGoogleMaps();
    },

    initializeForm() {
        const form = document.getElementById('editUnitForm');
        if (!form) return;

        // Initialize draft handling if FormManager available
        if (window.FormManager) {
            FormManager.initializeDraftHandling(form, `unit-edit-draft-${this.unitId}`);
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(e);
        });
    },

    async handleSubmit(e) {
        const form = e.target;
        
        if (window.FormManager && !FormManager.validateForm(form)) {
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (window.FormManager) {
            FormManager.setSubmitButtonLoading(submitBtn, true, 'Saving...');
        }

        try {
            const formData = new FormData(form);
            const amenities = formData.getAll('amenities');
            
            const unitData = {
                unitNumber: formData.get('unitNumber'),
                propertyType: formData.get('propertyType'),
                streetAddress: formData.get('streetAddress'),
                city: formData.get('city'),
                state: formData.get('state'),
                zipCode: formData.get('zipCode'),
                bedrooms: parseInt(formData.get('bedrooms')),
                bathrooms: parseFloat(formData.get('bathrooms')),
                squareFeet: parseInt(formData.get('squareFeet')),
                monthlyRent: parseFloat(formData.get('monthlyRent')),
                amenities: amenities
            };

            // Add optional fields
            const building = formData.get('building');
            const floor = formData.get('floor');
            if (building?.trim()) unitData.building = building;
            if (floor) unitData.floor = parseInt(floor);

            const response = await CasaConnect.APIClient.put(
                `/api/manager/units/${this.unitId}`,
                unitData
            );

            if (response.success) {
                CasaConnect.NotificationManager.success('Unit updated successfully!');
                setTimeout(() => {
                    window.location.href = `/manager/units/${this.unitId}`;
                }, 1500);
            } else {
                throw new Error(response.error || 'Failed to update unit');
            }
        } catch (error) {
            CasaConnect.NotificationManager.error(error.message);
            if (window.FormManager) {
                FormManager.setSubmitButtonLoading(submitBtn, false);
            }
        }
    },

    initializeGoogleMaps() {
        if (window.google?.maps?.places) {
            const input = document.getElementById('streetAddress');
            if (input) {
                const autocomplete = new google.maps.places.Autocomplete(input, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' }
                });
                
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.address_components) {
                        this.fillAddressFields(place);
                    }
                });
            }
        }
    },

    fillAddressFields(place) {
        const components = {
            street_number: '',
            route: '',
            locality: '',
            administrative_area_level_1: '',
            postal_code: ''
        };
        
        place.address_components.forEach(component => {
            const types = component.types;
            if (types.includes('street_number')) components.street_number = component.long_name;
            if (types.includes('route')) components.route = component.long_name;
            if (types.includes('locality')) components.locality = component.long_name;
            if (types.includes('administrative_area_level_1')) components.administrative_area_level_1 = component.short_name;
            if (types.includes('postal_code')) components.postal_code = component.long_name;
        });
        
        document.getElementById('streetAddress').value = `${components.street_number} ${components.route}`.trim();
        document.getElementById('city').value = components.locality;
        document.getElementById('state').value = components.administrative_area_level_1;
        document.getElementById('zipCode').value = components.postal_code;
    }
};

window.navigateBack = () => {
    window.location.href = `/manager/units/${UnitEditManager.unitId}`;
};

window.togglePropertyFields = () => {
    const propertyType = document.getElementById('propertyType')?.value;
    const buildingFloorRow = document.getElementById('buildingFloorRow');
    
    if (buildingFloorRow) {
        if (['apartment', 'condo', 'studio'].includes(propertyType)) {
            buildingFloorRow.style.display = 'flex';
        } else {
            buildingFloorRow.style.display = 'none';
            document.getElementById('building').value = '';
            document.getElementById('floor').value = '';
        }
    }
};