#  **IoT-Based Air Quality Index Prediction for Streets**
## <ins>Proposed Solution</ins>
> Deploy micro AQI sensors on streetlights and buses for hyperlocal monitoring
 ## <ins>Tech Stack</ins>
![25c132aa-6cba-47c6-91f8-7018daf1a3ce](https://github.com/user-attachments/assets/64238094-bdad-4942-9d30-b3fe681331c6)  ![50715789-1a67-488b-abfa-4208bba4c1fe](https://github.com/user-attachments/assets/2b33e2c6-7be7-466a-8843-dcf047325605)
## <ins>key features</ins>

###1. key features:
   - ### Landing Page:
     ![bf2e856b-b267-49fc-b163-60219ebc7b4c](https://github.com/user-attachments/assets/34de2946-af4d-42a4-ae4d-4afab9721ca2) 


   - ### 🛠 Core Functionalities
### 1. Geospatial AQI Monitoring
> Real-time Visualization: Interactive map interface (Leaflet/OpenStreetMap) displaying sensor nodes across the Kilpauk and Egmore zones.

> Spatial Heatmapping: Dynamic color-coded radius overlays indicating Air Quality Index (AQI) levels at specific coordinates (e.g., Green for 'Good', Red for 'Poor').

> Localized Data Drill-down: Hover or click functionality to retrieve specific metrics for individual locations such as Ormes Road, Flowers Road, and Halls Road.

### 2. Sensor Management System
> Live Status Tracking: A dashboard summary showing the total sensor count, segmented by Online and Offline status.

> Hardware Registry: Individual sensor cards (e.g., KP-002, EG-001) providing unique IDs and precise deployment addresses.

> Network Health Monitoring: Visual indicators (radio icons) to quickly identify connectivity issues within the sensor mesh.

### 3. Environment Simulation Engine
> Live Modeling: A control suite to Start, Stop, or Reset environmental simulations, allowing for "what-if" scenario testing.

> Dynamic Scaling: Real-time adjustment of sensor density (using the +/- toggle) to observe how changing the number of active nodes affects data granularity.

> System Console: A low-latency terminal interface providing raw system logs and command execution feedback ([SYSTEM] Environment Simulator Ready).

### 4. User Interface & Controls
> Contextual Search: Integrated search bar for rapid navigation between specific monitoring zones (Kilpauk/Egmore).

> Adaptive Display: Support for Dark/Light mode and system notifications via the top-right utility bar.


## relevant code snippets
### File Structures:
  # Project File Structure: AQI Project

## Directory Overview

```text
/workspaces/aqiproject/
├── aqiproject/                 # Django project settings
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
├── core/                       # Main app: models, views, and business logic
│   ├── models.py               # Sensor, Reading, and BlogPost models
│   ├── views.py                # Dashboard, analytics, and blog views
│   ├── urls.py                 # Core app URL routing
│   ├── admin.py                # Django admin configuration
│   ├── migrations/             # Database migration history
│   └── templates/              # HTML Templates
│       ├── dashboard.html      # Main dashboard interface
│       ├── blog.html           # Blog listing page
│       ├── blog_detail.html    # Individual blog post view
│       ├── settings.html       # User/App settings page
│       └── analytics.html      # Data visualization/Analytics page
├── api/                        # REST API Layer
│   ├── views.py                # API endpoint logic
│   ├── serializers.py          # Data serialization for models
│   ├── urls.py                 # API-specific routing
│   └── permissions.py          # Custom API access controls
├── static/                     # Static Assets
│   ├── css/
│   │   └── styles.css          # Main stylesheet (WARNING: 3500+ lines)
│   ├── js/
│   │   ├── app.js              # Main application logic
│   │   ├── map.js              # Leaflet.js map integration
│   │   ├── blog.js             # Blog-specific interactions
│   │   └── aqi_widget_terminal.js
│   ├── sensor_data.json        # Simulated sensor data (Hardcoded)
│   ├── sensor_logs.json        # Static log data
│   └── img/                    # Image assets
├── media/                      # User-uploaded content
├── manage.py                   # Django management script
└── db.sqlite3                  # Local SQLite database
``` 

   
### CORE MODELS (core/models.py):

   class Sensor(models.Model):
    sensor_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150, blank=True)
    area = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.name or self.sensor_id


class Reading(models.Model):
    """Sensor readings with environmental data"""
    slave_id = models.IntegerField(null=True, blank=True)
    sensor = models.ForeignKey(Sensor, on_delete=models.SET_NULL, 
                               related_name="readings", null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now)
    temperature = models.FloatField(null=True, blank=True)
    humidity = models.FloatField(null=True, blank=True)
    air_quality = models.FloatField(null=True, blank=True)
    aqi_category = models.CharField(max_length=50, blank=True)
    aqi_color = models.CharField(max_length=20, blank=True)
    co_level = models.FloatField(null=True, blank=True)
    no_level = models.FloatField(null=True, blank=True)
    smoke = models.FloatField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"slave:{self.slave_id or 'unk'} @ {self.timestamp:%Y-%m-%d %H:%M}"


class BlogPost(models.Model):
    STATUS_CHOICES = (
        ("draft", "Draft"),
        ("published", "Published"),
    )
    
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    author = models.ForeignKey("auth.User", on_delete=models.SET_NULL, 
                               null=True, blank=True, related_name="posts")
    content = models.TextField()
    excerpt = models.TextField(blank=True)
    image = models.ImageField(upload_to="img/", null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at"]

    def save(self, *args, **kwargs):
        if self.status == "published" and not self.published_at:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

## API Serializers:
   class SensorNestedSerializer(serializers.ModelSerializer):
    """Lightweight sensor serializer for nested representation."""
    class Meta:
        model = Sensor
        fields = ('id', 'sensor_id', 'name', 'latitude', 'longitude')


class ReadingSerializer(serializers.ModelSerializer):
    aqi = serializers.SerializerMethodField(read_only=True)
    sensor_detail = SensorNestedSerializer(source='sensor', read_only=True)

    class Meta:
        model = Reading
        fields = '__all__'
        read_only_fields = ('aqi', 'sensor_detail', 'timestamp')

    def get_aqi(self, obj):
        return obj.air_quality

    def validate(self, data):
        # Validate temperature range (-50 to 60 Celsius)
        if 'temperature' in data:
            if not -50 <= data['temperature'] <= 60:
                raise serializers.ValidationError({
                    'temperature': 'Temperature must be between -50 and 60 degrees'
                })
        # Validate humidity range (0 to 100%)
        if 'humidity' in data:
            if not 0 <= data['humidity'] <= 100:
                raise serializers.ValidationError({
                    'humidity': 'Humidity must be between 0 and 100%'
                })
        return data


class SensorSerializer(serializers.ModelSerializer):
    """Sensor model with latest reading."""
    latest = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = ('id', 'sensor_id', 'name', 'area', 'latitude', 
                  'longitude', 'is_active', 'latest')

    def get_latest(self, obj):
        reading = obj.readings.first()
        return ReadingSerializer(reading).data if reading else None

## API Endpoints (api/urls.py & api/views.py) :
```
   API Routes:
  GET  /api/sensors/                    - List all sensors with latest readings
  GET  /api/sensors/<id>/readings/      - Get readings for specific sensor
  GET  /api/sensor-data/                - Get all sensor data (simulated)
  GET  /api/blog/                       - List all blog posts
  GET  /api/blog/<id>/                  - Get specific blog post
  POST /api/start-simulation/           - Start sensor data simulation
  POST /api/stop-simulation/            - Stop sensor data simulation
  GET  /api/simulation-state/           - Get current simulation state


@api_view(['GET'])
def sensor_list(request):
    """Retrieve all sensors with their latest readings."""
    sensors = Sensor.objects.all()
    serializer = SensorSerializer(sensors, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def sensor_readings(request, sensor_id):
    """Get readings for a specific sensor with filtering options."""
    sensor = get_object_or_404(Sensor, pk=sensor_id)
    readings = sensor.readings.all()
    
    # Optional: Filter by hours
    hours = request.query_params.get('hours', None)
    if hours:
        from datetime import timedelta
        past_time = timezone.now() - timedelta(hours=int(hours))
        readings = readings.filter(timestamp__gte=past_time)
    
    serializer = ReadingSerializer(readings, many=True)
    return Response({
        'sensor_name': sensor.name,
        'readings': serializer.data,
        'stats': calculate_stats(readings)
    })


def calculate_stats(readings):
    """Calculate average, min, max for readings."""
    if not readings.exists():
        return None
    
    aqi_values = list(readings.values_list('air_quality', flat=True))
    return {
        'avg': sum(aqi_values) / len(aqi_values),
        'min': min(aqi_values),
        'max': max(aqi_values)
    }
```
## SENSOR DATA FETCHING & STATE MANAGEMENT (static/js/app.js) :
```
   // Global State
window.sensorState = {};
window.activeSensorCount = 1;
window.selectedSensorId = null;
window.selectedSensorData = null;

// Select Sensor
async function selectSensor(sensorId, sensorIndex) {
    window.selectedSensorId = sensorId;
    console.log('📍 Selected sensor:', sensorId);
    
    // Highlight selected card
    document.querySelectorAll('.sensor-card-wrapper').forEach(wrapper => {
        if (wrapper.dataset.sensorId === sensorId) {
            wrapper.classList.add('selected');
        } else {
            wrapper.classList.remove('selected');
        }
    });
    
    updateMapStreetView();
    await loadSensorData(sensorId);
    updateAllWidgets();
}

// Load Sensor Data
async function loadSensorData(sensorId) {
    try {
        const response = await fetch(`/api/sensors/${sensorId}/readings/?hours=24&limit=100`);
        const data = await response.json();
        
        if (data.readings && data.readings.length > 0) {
            window.selectedSensorData = {
                sensorId: sensorId,
                sensorName: data.sensor_name,
                readings: data.readings,
                stats: data.stats
            };
            console.log('✅ Loaded sensor data:', sensorId, window.selectedSensorData);
        }
    } catch (error) {
        console.error('Error loading sensor data:', error);
        window.selectedSensorData = null;
    }
}

// Fetch Real-time Sensor Data
async function fetchSimulatedSensorData() {
    try {
        const res = await fetch('/api/sensor-data/');
        const json = await res.json();

        if (!json.data) return;

        window.sensorState = {};
        const count = window.activeSensorCount;

        json.data.slice(0, count).forEach((s, index) => {
            const mapSensor = window.sensors[index + 1];
            if (!mapSensor) return;

            window.sensorState[mapSensor.id] = {
                id: mapSensor.id,
                name: mapSensor.name,
                lat: s.latitude,
                lng: s.longitude,
                aqi: s.aqi,
                no2: s.no2,
                co: s.co,
                smoke: s.smoke,
                humidity: s.humidity || 50
            };
        });

        updateSensorCardsFromDB();
        
        if (typeof window.updateStreetPolylineColors === 'function') {
            window.updateStreetPolylineColors();
        }
        
        if (window.selectedSensorId) {
            updateMapStreetView();
        } else {
            updateHeatmapFromLiveData();
        }

    } catch (error) {
        console.error('Error fetching sensor data:', error);
    }
}

// Update Street View Card
function updateMapStreetView() {
    const streetViewCard = document.querySelector('.street-view-card');
    if (!streetViewCard) return;
    
    if (!window.selectedSensorId) {
        streetViewCard.innerHTML = `
            <div class="street-view-compact">
                <div class="street-icon">
                    <i class="fas fa-map-marker-alt"></i>
                </div>
                <div class="street-details">
                    <h4>Select a Sensor</h4>
                    <p>Click on a map marker</p>
                </div>
            </div>
        `;
        updateHeatmapFromLiveData();
        return;
    }
    
    let sensorInfo = null;
    for (let key in window.sensors) {
        if (window.sensors[key].id === window.selectedSensorId) {
            sensorInfo = window.sensors[key];
            break;
        }
    }
    
    const liveData = window.sensorState[window.selectedSensorId];
    const aqi = liveData?.aqi ?? 0;
    const color = getAQIColor(aqi);
    const category = getAQICategory(aqi);
    
    streetViewCard.innerHTML = `
        <div class="street-view-compact">
            <div class="street-icon" style="background: ${color}20; color: ${color}">
                <i class="fas fa-broadcast-tower"></i>
            </div>
            <div class="street-details">
                <h4>${sensorInfo.name}</h4>
                <div class="aqi-compact">
                    <span class="aqi-value" style="color: ${color}">${Math.round(aqi)}</span>
                    <span class="aqi-label">AQI - ${category.text}</span>
                </div>
            </div>
        </div>
    `;
    
    updateHeatmapFromLiveData();
}
```


# API documentations :
  # AQI Project API Usage Guide

## Overview
> Complete OpenAPI 3.0 specification has been generated for the AQI Project API. The spec includes all endpoints, request/response schemas, parameters, and examples.

## OpenAPI Specification File
- **File:** `openapi.json` (root directory)
- **Format:** OpenAPI 3.0.0
- **Base URL (Development):** `http://localhost:8000/api`

## Viewing the OpenAPI Spec

### Option 1: Swagger UI (Recommended - Interactive)
Host the spec using Swagger UI:

```bash
# Using npm
npm install -g swagger-ui-dist
swagger-ui-dist -u ./openapi.json

# Or use online viewer
# Visit: https://editor.swagger.io/
# Then File > Import URL > https://your-domain/openapi.json
```

### Option 2: ReDoc (Documentation-focused)
```bash
# Using npm
npm install -g redoc-cli
redoc-cli serve openapi.json
```

### Option 3: Online Swagger Editor
1. Go to https://editor.swagger.io/
2. Click "File" → "Import File"
3. Select `openapi.json`

### Option 4: Direct File View
Open `openapi.json` in your code editor or browser for raw viewing.

## API Endpoints Summary

### Sensors
- `GET /sensors/` - List all active sensors
- `GET /sensors/{id}/` - Get single sensor
- `GET /sensors/{sensor_id}/readings/` - Get sensor readings (with stats)
- `GET /sensors/{sensor_id}/forecast/` - Get 24h AQI forecast

### Readings
- `GET /readings/` - List readings (filterable by sensor, date range)
- `POST /ingest/` - Ingest single reading
- `POST /readings/bulk_ingest/` - Bulk ingest multiple readings

### Simulation
- `POST /simulation/start/` - Start simulation
- `POST /simulation/stop/` - Stop simulation
- `POST /simulation/reset/` - Reset simulation
- `GET /simulation/status/` - Get simulation status
- `GET /simulation/data/` - Get current simulated data
- `GET /simulation/history/` - Get historical data
- `GET /simulation/logs/` - Get simulation logs
- `POST /simulation/set_sensor_count/` - Set active sensor count
- `GET /simulation/debug/` - Debug diagnostics

### Database Sync
- `POST /simulation/manual-sync/` - Manually sync JSON to database

### Blog
- `GET /blogposts/` - List published blog posts
- `POST /blogposts/` - Create new blog post
- `GET /blogposts/{id}/` - Get single blog post
- `PUT /blogposts/{id}/` - Update blog post
- `DELETE /blogposts/{id}/` - Delete blog post

## Quick Examples

### Get Sensor Readings (Last 12 hours)
```bash
curl -X GET "http://localhost:8000/api/sensors/KP-002/readings/?hours=12&limit=100"
```

### Ingest Single Reading
```bash
curl -X POST "http://localhost:8000/api/ingest/" \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "KP-002",
    "sensor_name": "KP-002",
    "timestamp": "2026-02-09 12:34:56",
    "temperature": 25.1,
    "humidity": 55.2,
    "pm25": 42.3,
    "no2": 12.1,
    "co": 0.6,
    "aqi": 42,
    "aqi_category": "Moderate",
    "aqi_color": "Yellow",
    "latitude": 13.0818,
    "longitude": 80.2460
  }'
```

### Set Sensor Count
```bash
curl -X POST "http://localhost:8000/api/simulation/set_sensor_count/" \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'
```

### Get Sensor Forecast
```bash
curl -X GET "http://localhost:8000/api/sensors/KP-002/forecast/"
```

### List Blog Posts
```bash
curl -X GET "http://localhost:8000/api/blogposts/"
```

## Data Models

### Sensor
```json
{
  "id": 1,
  "sensor_id": "KP-002",
  "name": "KP-002",
  "area": "Ormes Road",
  "latitude": 13.0818,
  "longitude": 80.2460,
  "is_active": true
}
```

### Reading
```json
{
  "id": 1,
  "sensor": 1,
  "slave_id": 1,
  "timestamp": "2026-02-09T12:34:56Z",
  "temperature": 25.1,
  "humidity": 55.2,
  "air_quality": 42,
  "aqi_category": "Moderate",
  "aqi_color": "Yellow",
  "co_level": 0.6,
  "no_level": 12.1,
  "smoke": null,
  "latitude": 13.0818,
  "longitude": 80.2460
}
```

### Blog Post
```json
{
  "id": 1,
  "title": "Air Quality Update",
  "slug": "air-quality-update",
  "excerpt": "Latest air quality trends",
  "content": "<p>Article content...</p>",
  "featured_image": "http://example.com/image.jpg",
  "status": "published",
  "created_at": "2026-02-09T12:00:00Z",
  "published_at": "2026-02-09T12:00:00Z",
  "author": {
    "id": 1,
    "username": "admin"
  }
}
```

## Query Parameters

### Readings List Filters
- `sensor` - Filter by sensor ID or sensor name
- `from` - Start date (ISO 8601)
- `to` - End date (ISO 8601)
- `limit` - Limit results

### Sensor Readings
- `limit` - Max records (default: 100)
- `hours` - Look back hours (default: 24)

### History Query
- `sensor` - Filter by sensor name
- `limit` - Limit results

## Authentication & Permissions

### Default Setup
- **Sensors/Readings:** Read allowed for all
- **Ingestion:** Open (consider protecting in production)
- **Simulation Control:** Open (consider protecting in production)
- **Blog Posts:** 
  - Read: Public
  - Create/Update/Delete: Authenticated users (DRF `IsAuthenticatedOrReadOnly`)

### Best Practices
1. Add API token authentication for production
2. Use DRF's `TokenAuthentication` or similar
3. Add rate limiting to ingestion endpoints
4. Restrict simulation control to authenticated admin users

## Error Responses

Standard HTTP status codes:
- `200` OK
- `201` Created
- `204` No Content
- `400` Bad Request (validation errors)
- `404` Not Found
- `500` Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

## Integration with Postman

1. Open Postman
2. Click "Import" (top left)
3. Select "Link" tab
4. Paste: `file:///path/to/openapi.json`
5. Click "Continue"
6. Postman will auto-generate a collection with all endpoints

## Deployment Notes

### Static File Serving
- Ensure `DEBUG=False` in production
- Use `python manage.py collectstatic`
- Serve `openapi.json` from web root for easy access

### CORS Configuration
If API is accessed from different domain:
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://yourdomain.com",
]
```

### Rate Limiting (Optional)
```bash
pip install djangorestframework-throttling
```

Then add to viewsets:
```python
throttle_classes = [UserRateThrottle]
```

## Support

For API issues:
1. Check `openapi.json` for endpoint details
2. Review server logs
3. Use `/api/simulation/debug/` for diagnostics
4. Check database via Django admin

## Version Info
- **API Version:** 1.0.0
- **OpenAPI Version:** 3.0.0
- **Generated:** February 9, 2026
- **Django Version:** 6.0.2+
- **DRF Version:** Latest compatible
    

# How to Run the Project:

## How to Run Project

### Prerequisites
- **Python** 3.8 or higher
- **pip** (Python package manager)
- **git** (for cloning the repository)

### Quick Start (5-10 minutes)

#### 1. Clone the Repository
```bash
git clone https://github.com/jswnthh/aqiproject.git
cd aqiproject
```

#### 2. Create Virtual Environment

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (Command Prompt):**
```cmd
python -m venv venv
venv\Scripts\activate
```

**Windows (PowerShell):**
```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

#### 3. Install Dependencies
```bash
pip install --upgrade pip
pip install django==6.0.2
pip install djangorestframework
pip install pillow
pip install django-cors-headers
pip install python-dotenv
```

#### 4. Configure Environment
Create a `.env` file in the project root:
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:8000
```

**Generate a secure SECRET_KEY:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

#### 5. Setup Database
```bash
# Run migrations
python manage.py migrate

# Create admin superuser
python manage.py createsuperuser
# Follow prompts to create admin account
```

#### 6. Run Development Server
```bash
python manage.py runserver
```

**Expected output:**
```
System check identified no issues (0 silenced).
Django version 6.0.2, using settings 'aqiproject.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

### Access the Application

- **Main App:** http://localhost:8000/
- **Admin Panel:** http://localhost:8000/admin/
- **API:** http://localhost:8000/api/
- **API Documentation:** See [openapi.json](openapi.json)

### Start Sensor Simulation (Optional)

In a new terminal window:
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # or your Windows activation command

# Start simulation
curl -X POST http://localhost:8000/api/simulation/start/

# Check status
curl http://localhost:8000/api/simulation/status/

# View logs
curl http://localhost:8000/api/simulation/logs/
```

### Verify Setup

Run this verification command to confirm everything is working:
```bash
python manage.py check
```

Expected output:
```
System check identified no issues (0 silenced).
```

### Troubleshooting

**Port 8000 Already in Use:**
```bash
# Use different port
python manage.py runserver 8001
```

**Database Error:**
```bash
# Reset database (development only)
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

**Module Not Found:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/macOS
# or
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

### Next Steps

- Check [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) for detailed setup & troubleshooting
- Review [API_USAGE_GUIDE.md](API_USAGE_GUIDE.md) for API documentation
- Visit [openapi.json](openapi.json) for OpenAPI specification
- Access Django admin at `/admin/` to manage data

### Useful Commands

```bash
# Access Django interactive shell
python manage.py shell

# Create migrations for model changes
python manage.py makemigrations

# Apply pending migrations
python manage.py migrate

# Collect static files (production)
python manage.py collectstatic

# Run tests
python manage.py test

# Flush database (delete all data)
python manage.py flush

# Deactivate virtual environment
deactivate
```
