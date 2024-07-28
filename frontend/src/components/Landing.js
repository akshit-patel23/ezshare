import React from 'react'
import bg from '../Assets/bg.png'
import './Landing.css'

export default function Landing() {
  return (
    <div>
        <div className='content'>
            <div className='left'>
              <div className="texts">
              <h1>Direct, Secure, and Lightning-Fast <br />File Sharing</h1>
              <div class="features">
                <div class="icon">Icon 1</div>
                <div class="text">Text 1</div>
                <div class="icon">Icon 2</div>
                <div class="text">Text 2</div>
                <div class="icon">Icon 3</div>
                <div class="text">Text 3</div>
              </div>
              </div>
            </div>
            <div className='right'>
            <img className="bgimg" src={bg} alt="" />
            </div>
        </div>
    </div>
  )
}
