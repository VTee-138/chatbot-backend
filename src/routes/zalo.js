const express = require('express');
const router = express.Router();
const zaloController = require('../controllers/zaloController');
const { authenticate } = require('../middleware/auth');

/**
 * @route   GET /api/v1/zalo/connect
 * @desc    Initiate Zalo OA OAuth flow (returns auth URL)
 * @access  Private (requires admin/owner role)
 * @query   groupId - The group ID to add the channel to
 */
router.get('/connect', authenticate, zaloController.initiateZaloOAuth);

/**
 * @route   GET /api/v1/zalo/callback
 * @desc    Handle Zalo OAuth callback
 * @access  Public (no auth required for OAuth callback)
 * @query   code - Authorization code from Zalo
 * @query   state - State parameter for CSRF protection
 * @query   oa_id - Zalo Official Account ID
 */
router.get('/callback', zaloController.handleZaloCallback);
// ACCESS_TOKEN đây là ACCESS_TOKEN CỦA OA
/**
 * Output demo
 *  "data": {
    "total": 1,
    "count": 10,
    "offset": 0,
    "users": [
      {
        "user_id": "3103741396296991610"
      }
    ]
  },
  "error": 0,
  "message": "Success"
 * 
 */
// API NÀY DÙNG ĐỂ GET NHỮNG NGƯỜI QUAN TÂM ĐẾN OA
router.post('/oa/get-users', async (req, res) => {
  try {
    const {
      access_token,
      offset = 0,
      count = 15,
      last_interaction_period = 'TODAY',
      is_follower = true,
      tag_name
    } = req.body;

    if(!access_token) {
      return res.status(400).json({ success: false, message: 'Missing access_token' });
    }
    const data = {
      offset,
      count,
      last_interaction_period,
      is_follower
    };
    if(tag_name) {
      data.tag_name = tag_name;
    }
    const response = await axios.get('https://openapi.zalo.me/v3.0/oa/user/getlist', {
      headers: {
        'access_token': access_token
      },
      params: {
        data: JSON.stringify(data) 
      }
    });

    return res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/**
 * Output demo
 * User detail: {
  "data": {
    "user_id": "3103741396296991610",
    "user_id_by_app": "45342013118720098",
    "user_external_id": "",
    "display_name": "Lê Quốc Anh",
    "user_alias": "Lê Quốc Anh",
    "is_sensitive": false,
    "user_last_interaction_date": "04/10/2025",
    "user_is_follower": true,
    "avatar": "https://s120-ava-talk.zadn.vn/4/5/a/d/0/120/a7ec0238f7dc97d0d65262b158bcc731.jpg",
    "avatars": {
      "120": "https://s120-ava-talk.zadn.vn/4/5/a/d/0/120/a7ec0238f7dc97d0d65262b158bcc731.jpg",
      "240": "https://s240-ava-talk.zadn.vn/4/5/a/d/0/240/a7ec0238f7dc97d0d65262b158bcc731.jpg"
    },


    "dynamic_param": "",
    "tags_and_notes_info": {
      "notes": [],
      "tag_names": []
    },
    "shared_info": {
      "address": "",
      "city": "",
      "district": "",
      "phone": 0,
      "name": "",
      "user_dob": ""
    }
  },
  "error": 0,
  "message": "Success"
}
 */
// API NÀY LẤY THÔNG TIN CỦA NGƯỜI GỬI
router.post('/oa/get-user-detail', async (req, res) => {
  try {
    const { access_token, user_id } = req.body;
    if(!access_token) 
    {
      return res.status(400).json({ success: false, message: 'Missing access_token' });
    }
    if(!user_id) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }
    const data = { user_id };
    const response = await axios.get('https://openapi.zalo.me/v3.0/oa/user/detail', {
      headers: {
        'access_token': access_token
      },
      params: {
        data: JSON.stringify(data)
      }
    });

    return res.json(response.data);

  } catch(error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

//API LẤY TIN NHẮN CUỘC HỘI THOẠI, kiểu như mình sẽ lướt lên thì load tin nhắn cũ BLA BLA,...
/**
 * output mẫu
 * {
    "data": [
        {
            "src": 1,
            "time": 1759512710365,
            "sent_time": "00:31:50 04/10/2025",
            "from_id": "3103741396296991610",
            "from_display_name": "Lê Quốc Anh",
            "from_avatar": "https://s240-ava-talk.zadn.vn/4/5/a/d/0/240/a7ec0238f7dc97d0d65262b158bcc731.jpg",
            "to_id": "3592353763697768582",
            "to_display_name": "10 Education",
            "to_avatar": "https://s240-ava-talk.zadn.vn/6/2/f/0/1/240/df78a3f7d78654d52e33eb0d93a9bb45.jpg",
            "message_id": "ccc5500cdb7842201b6f",
            "type": "text",
            "message": "a"
        }
    ],
    "error": 0,
    "message": "Success"
}
 */

router.post('/oa/get-conversations', async (req, res) => {
  try {
    const { access_token, user_id, offset = 0, count = 5 } = req.body;

    if (!access_token) {
      return res.status(400).json({ success: false, message: 'Missing access_token' });
    }
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'Missing user_id' });
    }

    const data = { user_id, offset, count };

    const response = await axios.get('https://openapi.zalo.me/v2.0/oa/conversation', {
      headers: { access_token },
      params: { data: JSON.stringify(data) }
    });

    return res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Route để lấy danh sách recent chat OA
/**
 * output mẫu  "data": [
    {
      "src": 1,
      "time": 1759512710557,
      "sent_time": "00:31:50 04/10/2025",
      "from_id": "3103741396296991610",
      "from_display_name": "Lê Quốc Anh",
      "from_avatar": "https://s240-ava-talk.zadn.vn/4/5/a/d/0/240/a7ec0238f7dc97d0d65262b158bcc731.jpg",
      "to_id": "3592353763697768582",
      "to_display_name": "10 Education",
      "to_avatar": "https://s240-ava-talk.zadn.vn/6/2/f/0/1/240/df78a3f7d78654d52e33eb0d93a9bb45.jpg",
      "message_id": "92a905608e14174c4e03",
      "type": "text",
      "message": "a"
    }
  ],
  "error": 0,
  "message": "Success"
}
 * 
 */

router.post('/oa/list-recent-chat', async (req, res) => {
  try {
    const { access_token, offset = 0, count = 5 } = req.body;

    if (!access_token) {
      return res.status(400).json({ success: false, message: 'Missing access_token' });
    }

    const data = { offset, count };

    const response = await axios.get('https://openapi.zalo.me/v2.0/oa/listrecentchat', {
      headers: { access_token },
      params: { data: JSON.stringify(data) }
    });

    return res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});
/**
 * API GỬI TIN NHẮN ĐẾN USER_ID
 */
router.post('/oa/send-message', async (req, res) => {
  try {
    const { access_token, user_id, text } = req.body;

    if (!access_token || !user_id || !text) {
      return res.status(400).json({ success: false, message: 'Missing access_token, user_id or text' });
    }

    const payload = {
      recipient: { user_id },
      message: { text }
    };

    const response = await axios.post('https://openapi.zalo.me/v3.0/oa/message/cs', payload, {
      headers: {
        'Content-Type': 'application/json',
        'access_token': access_token
      }
    });

    return res.json(response.data);

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});
/**
 * @route   POST /api/v1/zalo/webhook
 * @desc    Handle Zalo webhook events
 * @access  Public (Zalo will POST to this endpoint)
 */
router.post('/webhook', zaloController.handleZaloWebhook);

/**
 * @route   POST /api/v1/zalo/send-message
 * @desc    Send a message via Zalo OA
 * @access  Private
 * @body    channelId - The channel ID
 * @body    userId - Zalo user ID
 * @body    message - Message text
 */
router.post('/send-message', authenticate, zaloController.sendZaloMessage);

module.exports = router;